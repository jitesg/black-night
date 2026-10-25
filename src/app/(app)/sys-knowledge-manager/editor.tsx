/**
 * System Knowledge Manager — Article Editor
 *
 * Create / Edit system knowledge articles.
 * Tabs: Content | Metadata | Relations | Sections
 * Auto-saves change_notes and version on save.
 * Publish / archive shortcuts in header.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,  KeyboardAvoidingView, ActivityIndicator, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Save, ChevronDown, CheckCircle2, Archive, Eye,
  Type, Tag, Link2, BookOpen,
} from 'lucide-react-native';
import {
  getSysKnowledgeById, createSysKnowledgeArticle,
  updateSysKnowledgeArticle, publishSysKnowledge,
  archiveSysKnowledge, type SysKnowledgeArticle,
} from '@/lib/db/sysKnowledgeRepo';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledgeConstants';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const GREEN   = '#059669';
const RED     = '#DC2626';
const MUTED   = '#6B7280';

type Tab = 'content' | 'metadata' | 'relations' | 'sections';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'content',   label: 'Content',   icon: Type    },
  { id: 'metadata',  label: 'Metadata',  icon: Tag     },
  { id: 'relations', label: 'Relations', icon: Link2   },
  { id: 'sections',  label: 'Sections',  icon: BookOpen },
];

type FormState = {
  title: string; subtitle: string; category: string; subcategory: string;
  crime_type: string; description: string; content: string;
  tags: string; keywords: string; attachment_uris: string;
  bns_sections: string; bnss_sections: string;
  investigation_stage: string; evidence_type: string;
  related_sop: string; related_circular: string; related_format: string;
  related_checklist: string; related_judgment: string; related_knowledge: string;
  author: string; change_notes: string;
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground mb-1">
      {label}{required && <Text style={{ color: RED }}> *</Text>}
    </Text>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline = false, required, lines = 3,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; required?: boolean; lines?: number;
}) {
  return (
    <View className="gap-1">
      <FieldLabel label={label} required={required} />
      <Input
        type={multiline ? 'multiline' : 'text'}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        numberOfLines={multiline ? lines : undefined}
      />
    </View>
  );
}

function PickerField({
  label, value, options, onSelect, required,
}: {
  label: string; value: string; options: string[];
  onSelect: (v: string) => void; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1">
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center bg-background border border-border rounded-xl px-3 py-2.5 gap-2 active:opacity-70"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
          {value || `Select ${label}…`}
        </Text>
        <ChevronDown size={16} color={MUTED} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)}>
          <View className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl overflow-hidden" style={{ paddingBottom: 32 }}>
            <View className="h-1 w-12 rounded-full bg-border self-center mt-3 mb-2" />
            <Text className="text-base font-semibold text-foreground px-5 pb-3">{label}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {options.map(opt => (
                <Pressable key={opt} onPress={() => { onSelect(opt); setOpen(false); }}
                  className="flex-row items-center px-5 py-3.5 active:opacity-60">
                  <Text className="flex-1 text-sm text-foreground">{opt}</Text>
                  {value === opt && <CheckCircle2 size={16} color={GREEN} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 mt-2">
      {label}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SysKnowledgeEditor() {
  const insets  = useSafeAreaInsets();
  const { articleId } = useLocalSearchParams<{ articleId?: string }>();
  const isNew   = !articleId;

  const [tab, setTab]           = useState<Tab>('content');
  const [loading, setLoading]   = useState(!isNew);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [error, setError]       = useState('');
  const [article, setArticle]   = useState<SysKnowledgeArticle | null>(null);

  const [form, setForm] = useState<FormState>({
    title: '', subtitle: '', category: '', subcategory: '', crime_type: '',
    description: '', content: '', tags: '', keywords: '', attachment_uris: '[]',
    bns_sections: '', bnss_sections: '', investigation_stage: '', evidence_type: '',
    related_sop: '', related_circular: '', related_format: '',
    related_checklist: '', related_judgment: '', related_knowledge: '',
    author: 'Owner', change_notes: '',
  });

  const set = (key: keyof FormState) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  useEffect(() => {
    if (!isDevSessionActive()) { router.replace('/(app)/dev-options/pin-entry' as never); return; }
    if (!isNew && articleId) {
      (async () => {
        setLoading(true);
        try {
          const a = await getSysKnowledgeById(articleId);
          if (a) {
            setArticle(a);
            setForm({
              title: a.title, subtitle: a.subtitle ?? '', category: a.category,
              subcategory: a.subcategory, crime_type: a.crime_type ?? '',
              description: a.description, content: a.content ?? '',
              tags: a.tags, keywords: a.keywords ?? '', attachment_uris: a.attachment_uris,
              bns_sections: a.bns_sections ?? '', bnss_sections: a.bnss_sections ?? '',
              investigation_stage: a.investigation_stage ?? '', evidence_type: a.evidence_type ?? '',
              related_sop: a.related_sop ?? '', related_circular: a.related_circular ?? '',
              related_format: a.related_format ?? '', related_checklist: a.related_checklist ?? '',
              related_judgment: a.related_judgment ?? '', related_knowledge: a.related_knowledge ?? '',
              author: a.author ?? 'Owner', change_notes: '',
            });
          }
        } finally { setLoading(false); }
      })();
    }
  }, [articleId, isNew]);

  const handleSave = async () => {
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.category)     { setError('Category is required.'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const id = await createSysKnowledgeArticle(form);
        setSaved(true);
        setTimeout(() => router.replace({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: id } }), 600);
      } else {
        await updateSysKnowledgeArticle(articleId!, form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { setError('Failed to save. Please try again.'); }
    finally   { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!articleId) return;
    await publishSysKnowledge(articleId);
    setPublishDialog(false);
    setArticle(prev => prev ? { ...prev, status: 'published' } : prev);
  };

  const handleArchive = async () => {
    if (!articleId) return;
    await archiveSysKnowledge(articleId);
    setArchiveDialog(false);
    router.back();
  };

  const categoryDef = KNOWLEDGE_CATEGORIES.find(c => c.id === form.category);
  const subcategoryOptions = categoryDef?.subcategories ?? [];
  const categoryOptions    = KNOWLEDGE_CATEGORIES.map(c => c.id);

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color='#1E3A5F' />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">

      {/* Custom header */}
      <AppHeader
        title={isNew ? 'New Article' : (form.title || 'Edit Article')}
        subtitle={isNew ? 'System Knowledge' : `v${article?.version ?? 1} · ${article?.status ?? 'draft'}`}
        showBack
        actions={
          <View className="flex-row gap-2">
            {!isNew && article?.status !== 'published' && (
              <Pressable onPress={() => setPublishDialog(true)}
                className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70"
                style={{ backgroundColor: GREEN }}>
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-xs text-white font-semibold">Publish</Text>
              </Pressable>
            )}
            <Pressable onPress={handleSave}
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70"
              style={{ backgroundColor: saved ? GREEN : '#F59E0B' }}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
              <Text className="text-xs text-white font-semibold">{saved ? 'Saved!' : 'Save'}</Text>
            </Pressable>
          </View>
        }
      />

      {/* Tabs */}
      <View className="flex-row border-b border-border bg-card">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)}
              className="flex-1 flex-row items-center justify-center gap-1 py-3 active:opacity-60"
              style={{ borderBottomWidth: active ? 2 : 0, borderBottomColor: '#1E3A5F' }}>
              <Icon size={13} color={active ? '#1E3A5F' : MUTED} />
              <Text className="text-xs font-medium" style={{ color: active ? '#1E3A5F' : MUTED }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Error */}
      {!!error && (
        <View className="mx-4 mt-3 bg-red-50 rounded-xl px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── CONTENT tab ────────────────────────────────────────────── */}
          {tab === 'content' && (
            <View className="gap-4">
              <SectionLabel label="Basic Info" />
              <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="Article title…" required />
              <Field label="Subtitle" value={form.subtitle} onChangeText={set('subtitle')} placeholder="Optional subtitle" />
              <Field label="Summary / Description" value={form.description} onChangeText={set('description')}
                placeholder="Brief summary for search and display…" multiline lines={3} />

              <SectionLabel label="Article Body" />
              <View className="gap-1">
                <FieldLabel label="Content (Rich Text / Markdown)" />
                <Input
                  type="multiline"
                  value={form.content}
                  onChangeText={set('content')}
                  placeholder={"# Heading 1\n## Heading 2\n\n**Bold**, *Italic*, `Code`\n\n- Bullet list\n1. Numbered list\n\n> Blockquote\n\n---\n\nFull article content here…"}
                  numberOfLines={14}
                />
                <Text className="text-xs text-muted-foreground">Supports Markdown: # headings, **bold**, *italic*, - lists, &gt; quotes, `code`</Text>
              </View>

              <SectionLabel label="Change Notes" />
              <Field label="Version Notes" value={form.change_notes} onChangeText={set('change_notes')}
                placeholder="What changed in this version?" multiline lines={2} />
            </View>
          )}

          {/* ── METADATA tab ───────────────────────────────────────────── */}
          {tab === 'metadata' && (
            <View className="gap-4">
              <SectionLabel label="Classification" />
              <PickerField label="Category" value={form.category} options={categoryOptions} onSelect={set('category')} required />
              {subcategoryOptions.length > 0 && (
                <PickerField label="Subcategory" value={form.subcategory} options={['', ...subcategoryOptions]} onSelect={set('subcategory')} />
              )}
              <PickerField label="Crime Type" value={form.crime_type} options={[
                '', 'Murder', 'Robbery', 'Theft', 'Fraud', 'Assault', 'Kidnapping',
                'Cybercrime', 'NDPS', 'Arms Act', 'Domestic Violence', 'Property', 'Other',
              ]} onSelect={set('crime_type')} />
              <PickerField label="Investigation Stage" value={form.investigation_stage} options={[
                '', 'Pre-FIR', 'Post-FIR', 'Arrest', 'Remand', 'Charge Sheet', 'Trial', 'Acquittal', 'Conviction',
              ]} onSelect={set('investigation_stage')} />
              <PickerField label="Evidence Type" value={form.evidence_type} options={[
                '', 'Documentary', 'Forensic', 'Testimonial', 'Circumstantial', 'Digital', 'Physical', 'Medical',
              ]} onSelect={set('evidence_type')} />

              <SectionLabel label="Discovery" />
              <Field label="Tags" value={form.tags} onChangeText={set('tags')} placeholder="tag1, tag2, tag3" />
              <Field label="Keywords" value={form.keywords} onChangeText={set('keywords')} placeholder="keyword1, keyword2" />

              <SectionLabel label="Authorship" />
              <Field label="Author" value={form.author} onChangeText={set('author')} placeholder="Owner" />
            </View>
          )}

          {/* ── RELATIONS tab ──────────────────────────────────────────── */}
          {tab === 'relations' && (
            <View className="gap-4">
              <SectionLabel label="Applicable Law" />
              <Field label="BNS Sections" value={form.bns_sections} onChangeText={set('bns_sections')}
                placeholder="BNS 103, BNS 304…" multiline lines={2} />
              <Field label="BNSS Sections" value={form.bnss_sections} onChangeText={set('bnss_sections')}
                placeholder="BNSS 173, BNSS 208…" multiline lines={2} />

              <SectionLabel label="Related Content" />
              <Field label="Related SOP" value={form.related_sop} onChangeText={set('related_sop')} placeholder="SOP title or ID" />
              <Field label="Related Circular" value={form.related_circular} onChangeText={set('related_circular')} placeholder="Circular reference" />
              <Field label="Related Format" value={form.related_format} onChangeText={set('related_format')} placeholder="Format title or ID" />
              <Field label="Related Checklist" value={form.related_checklist} onChangeText={set('related_checklist')} placeholder="Checklist title or ID" />
              <Field label="Related Court Judgment" value={form.related_judgment} onChangeText={set('related_judgment')} placeholder="Case citation" />
              <Field label="Related Knowledge Articles" value={form.related_knowledge} onChangeText={set('related_knowledge')}
                placeholder="Article IDs or titles, comma-separated" multiline lines={2} />
            </View>
          )}

          {/* ── SECTIONS tab ───────────────────────────────────────────── */}
          {tab === 'sections' && (
            <View className="gap-4">
              <SectionLabel label="Module Integrations" />
              <Text className="text-sm text-muted-foreground leading-6">
                This article will be suggested in the following modules when contextually relevant:
              </Text>
              {[
                'Mukadma (FIR)',
                'GD (General Diary)',
                'Nyayalay (Court)',
                'My Halka (Beat Book)',
                'Prarthna Patra',
                'Nirodhatmak Karyvahi',
                'Predefine Formats',
                'Reminders',
                'AI Assistant',
              ].map(m => (
                <View key={m} className="flex-row items-center gap-3 py-2.5 border-b border-border">
                  <CheckCircle2 size={16} color={GREEN} />
                  <Text className="text-sm text-foreground">{m}</Text>
                  <Text className="ml-auto text-xs text-muted-foreground">Auto</Text>
                </View>
              ))}
              <Text className="text-xs text-muted-foreground mt-2">
                Integration is automatic based on category, tags, BNS/BNSS sections, and crime type.
                No manual wiring required.
              </Text>

              {!isNew && (
                <>
                  <SectionLabel label="Version & Audit" />
                  <Pressable
                    onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/[articleId]/versions' as never, params: { articleId } })}
                    className="flex-row items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 active:opacity-60"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Eye size={18} color='#1E3A5F' />
                    <Text className="flex-1 text-sm font-medium text-foreground">View Version History</Text>
                    <ChevronDown size={16} color={MUTED} style={{ transform: [{ rotate: '-90deg' }] }} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/[articleId]/audit' as never, params: { articleId } })}
                    className="flex-row items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 active:opacity-60"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <BookOpen size={18} color={MUTED} />
                    <Text className="flex-1 text-sm font-medium text-foreground">View Audit Trail</Text>
                    <ChevronDown size={16} color={MUTED} style={{ transform: [{ rotate: '-90deg' }] }} />
                  </Pressable>
                  {article?.status !== 'archived' && (
                    <Pressable onPress={() => setArchiveDialog(true)}
                      className="flex-row items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 active:opacity-60"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <Archive size={18} color={RED} />
                      <Text className="flex-1 text-sm font-medium" style={{ color: RED }}>Archive Article</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Publish dialog */}
      <AlertDialog open={publishDialog} onOpenChange={o => { if (!o) setPublishDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Article</AlertDialogTitle>
            <AlertDialogDescription>
              This article will be visible to all users in the Knowledge module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setPublishDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handlePublish} style={{ backgroundColor: GREEN }}>
              <Text className="text-white text-sm font-semibold">Publish</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive dialog */}
      <AlertDialog open={archiveDialog} onOpenChange={o => { if (!o) setArchiveDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Article</AlertDialogTitle>
            <AlertDialogDescription>
              This article will be archived and hidden from users. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setArchiveDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handleArchive} style={{ backgroundColor: '#2563EB' }}>
              <Text className="text-white text-sm font-semibold">Archive</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
