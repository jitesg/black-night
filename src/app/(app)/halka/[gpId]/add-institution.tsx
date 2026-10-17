import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Save, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import {
  createInstitution, getInstitutionById, updateInstitution,
  getHeadByInstitution, upsertInstitutionHead,
  getStaffByInstitution, createInstitutionStaff, deleteInstitutionStaff,
  type SocialInstitution, type InstitutionStaff,
} from '@/lib/db/institutionRepo';
import { INSTITUTION_CATEGORIES } from '@/lib/db/schema';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// Field — label + Input wrapper used by all halka institution screens
function Field({ label, value, onChange, placeholder, multiline, inputType, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; inputType?: 'mobile';
  required?: boolean;
}) {
  const type = inputType === 'mobile' ? 'mobile' : multiline ? 'multiline' : 'text';
  return (
    <Input
      type={type as any}
      label={label}
      required={required}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder || label}
      numberOfLines={multiline ? 2 : undefined}
    />
  );
}

export default function AddInstitutionScreen() {
  const { t } = useTranslation();
  const { gpId, editId } = useLocalSearchParams<{ gpId: string; editId?: string }>();
  const isEdit = !!editId;

  const [form, setForm] = useState({ category: '', name: '', address: '' });
  const [showCat, setShowCat] = useState(false);
  const [headForm, setHeadForm] = useState({ name: '', address: '', mobile: '', alternate_mobile: '' });
  const [staff, setStaff] = useState<InstitutionStaff[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', designation: '', mobile: '', alternate_mobile: '' });
  const [instId, setInstId] = useState<string | null>(editId ?? null);
  const [saving, setSaving] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [showStaffForm, setShowStaffForm] = useState(false);

  // ── Unsaved-changes protection ───────────────────────────────────────────
  const isDirty = useRef(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleBackPress = useCallback(() => {
    if (isDirty.current) { setShowDiscardDialog(true); } else { router.back(); }
  }, []);

  useFocusEffect(useCallback(() => {
    if (isEdit && editId) {
      (async () => {
        setLoading(true);
        const [inst, head, staffList] = await Promise.all([
          getInstitutionById(editId), getHeadByInstitution(editId), getStaffByInstitution(editId),
        ]);
        if (inst) setForm({ category: inst.category, name: inst.name, address: inst.address ?? '' });
        if (head) setHeadForm({ name: head.name, address: head.address ?? '', mobile: head.mobile ?? '', alternate_mobile: head.alternate_mobile ?? '' });
        setStaff(staffList);
        setLoading(false);
      })();
    }
  }, [isEdit, editId]));

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) { setShowDiscardDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const update = (k: keyof typeof form) => (v: string) => { isDirty.current = true; setForm((p) => ({ ...p, [k]: v })); setError(''); };
  const updateHead = (k: keyof typeof headForm) => (v: string) => { isDirty.current = true; setHeadForm((p) => ({ ...p, [k]: v })); };
  const updateNewStaff = (k: keyof typeof newStaff) => (v: string) => setNewStaff((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.category) { setError(t('halka.institution.errorCategoryRequired')); return; }
    if (!form.name.trim()) { setError(t('halka.institution.errorNameRequired')); return; }
    setSaving(true);
    try {
      let iid = instId;
      if (!iid) {
        const created = await createInstitution({ gp_id: gpId!, category: form.category, name: form.name.trim(), address: form.address || undefined });
        iid = created.id;
        setInstId(iid);
      } else {
        await updateInstitution(iid, { category: form.category, name: form.name.trim(), address: form.address || undefined });
      }
      if (headForm.name.trim()) {
        await upsertInstitutionHead({ institution_id: iid!, name: headForm.name.trim(), address: headForm.address || undefined, mobile: headForm.mobile || undefined, alternate_mobile: headForm.alternate_mobile || undefined });
      }
      if (!isEdit) { router.back(); return; }
    } catch { setError(t('halka.institution.errorSaveFailed')); }
    setSaving(false);
  };

  const handleAddStaff = async () => {
    if (!instId) { setError(t('halka.institution.errorSaveInstFirst')); return; }
    if (!newStaff.name.trim()) { setError(t('halka.institution.errorStaffNameRequired')); return; }
    setSavingStaff(true);
    try {
      const created = await createInstitutionStaff({ institution_id: instId, name: newStaff.name.trim(), designation: newStaff.designation || undefined, mobile: newStaff.mobile || undefined, alternate_mobile: newStaff.alternate_mobile || undefined });
      setStaff((p) => [...p, created]);
      setNewStaff({ name: '', designation: '', mobile: '', alternate_mobile: '' });
      setShowStaffForm(false);
    } catch { setError(t('halka.institution.errorAddStaffFailed')); }
    setSavingStaff(false);
  };

  if (loading) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator size="large" color="#2D52B8" /></View>;

  return (
    <View className="flex-1 bg-background">
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.unsavedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>{t('common.stay')}</AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>{t('common.discard')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader title={isEdit ? t('halka.institution.editTitle') : t('halka.institution.addTitle')} onBack={handleBackPress} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">

        <ScrollView contentContainerClassName="px-6 py-6 gap-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Institution details */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-foreground">{t('halka.institution.detailsTitle')}</Text>
            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.institution.fieldCategory')} <Text className="text-destructive">*</Text></Text>
              <Pressable onPress={() => setShowCat(!showCat)} className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between bg-card active:opacity-70" style={{ borderCurve: 'continuous' }}>
                <Text className={form.category ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>{form.category || t('halka.institution.placeholderCategory')}</Text>
                <ChevronDown size={16} color="#9CA3AF" />
              </Pressable>
              {showCat && (
                <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderCurve: 'continuous' }}>
                  {INSTITUTION_CATEGORIES.map((cat) => (
                    <Pressable key={cat} onPress={() => { update('category')(cat); setShowCat(false); }} className="px-4 py-3 border-b border-border last:border-b-0 active:bg-secondary">
                      <Text className={`text-base ${form.category === cat ? 'text-primary font-medium' : 'text-foreground'}`}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Field label={t('halka.institution.fieldName')} value={form.name} onChange={update('name')} required />
            <Field label={t('halka.shop.fieldAddress')} value={form.address} onChange={update('address')} multiline />
          </View>

          {/* Head of Institution */}
          <View className="bg-accent/30 rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
            <Text className="text-sm font-semibold text-foreground">{t('halka.institution.headTitle')}</Text>
            <Field label={t('halka.institution.fieldHeadName')} value={headForm.name} onChange={updateHead('name')} />
            <Field label={t('halka.shop.fieldAddress')} value={headForm.address} onChange={updateHead('address')} multiline />
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label={t('halka.person.fieldMobile')} value={headForm.mobile} onChange={updateHead('mobile')} inputType="mobile" /></View>
              <View className="flex-1"><Field label={t('halka.person.fieldAltMobile')} value={headForm.alternate_mobile} onChange={updateHead('alternate_mobile')} inputType="mobile" /></View>
            </View>
          </View>

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80" style={{ borderCurve: 'continuous' }}>
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">{saving ? t('common.saving') : isEdit ? t('common.update') : t('halka.institution.btnSave')}</Text>
          </Pressable>

          {/* Staff (only when institution saved) */}
          {(isEdit || instId) ? (
            <View className="gap-4">
              <View className="h-px bg-border" />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">{t('halka.institution.staffCount', { count: staff.length })}</Text>
                <Pressable onPress={() => setShowStaffForm(!showStaffForm)} className="flex-row items-center gap-1 active:opacity-60">
                  <Plus size={14} color="#2D52B8" />
                  <Text className="text-sm text-primary font-medium">{t('halka.institution.btnAddStaff')}</Text>
                </Pressable>
              </View>

              {staff.map((s) => (
                <View key={s.id} className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-3" style={{ borderCurve: 'continuous' }}>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                    {s.designation ? <Text className="text-xs text-muted-foreground">{s.designation}</Text> : null}
                    {s.mobile ? <Text className="text-xs text-muted-foreground">{s.mobile}</Text> : null}
                  </View>
                  <Pressable onPress={async () => { await deleteInstitutionStaff(s.id); setStaff((p) => p.filter((x) => x.id !== s.id)); }} className="p-1.5 active:opacity-60">
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}

              {showStaffForm && (
                <View className="bg-card border border-border rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
                  <Text className="text-sm font-semibold text-foreground">{t('halka.institution.newStaffTitle')}</Text>
                  <Field label={t('halka.person.fieldName')} value={newStaff.name} onChange={updateNewStaff('name')} required />
                  <Field label={t('halka.institution.fieldDesignation')} value={newStaff.designation} onChange={updateNewStaff('designation')} />
                  <View className="flex-row gap-3">
                    <View className="flex-1"><Field label={t('halka.person.fieldMobile')} value={newStaff.mobile} onChange={updateNewStaff('mobile')} inputType="mobile" /></View>
                    <View className="flex-1"><Field label={t('halka.person.fieldAltMobile')} value={newStaff.alternate_mobile} onChange={updateNewStaff('alternate_mobile')} inputType="mobile" /></View>
                  </View>
                  <Pressable onPress={handleAddStaff} disabled={savingStaff} className="bg-accent rounded-xl py-3 items-center active:opacity-80" style={{ borderCurve: 'continuous' }}>
                    <Text className="text-accent-foreground font-semibold text-sm">{savingStaff ? t('common.saving') : t('halka.institution.btnAddStaffMember')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
