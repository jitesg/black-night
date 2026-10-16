import { useState, useCallback, useRef } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Save, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import {
  createReligiousPlace, getReligiousPlaceById, updateReligiousPlace,
  getAuthorityByPlace, upsertAuthority,
  getEventsByPlace, createReligiousEvent, deleteReligiousEvent,
  type ReligiousPlace, type ReligiousAuthority, type ReligiousEvent,
} from '@/lib/db/religiousRepo';
import {
  RELIGIOUS_CATEGORIES, AUTHORITY_LABELS, EVENT_TYPES,
} from '@/lib/db/schema';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

function Dropdown({
  label, value, options, onSelect,
}: { label: string; value: string; options: readonly string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
        className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between bg-card active:opacity-70"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className={value ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>
          {value || `Select ${label}`}
        </Text>
        <ChevronDown size={16} color="#9CA3AF" />
      </Pressable>
      {open && (
        <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); setOpen(false); }}
              className="px-4 py-3 border-b border-border last:border-b-0 active:bg-secondary"
            >
              <Text className={`text-base ${value === opt ? 'text-primary font-medium' : 'text-foreground'}`}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

import { Input } from '@/components/ui/input';

// Field — label + Input wrapper used by add-religious
function Field({
  label, value, onChange, placeholder, multiline, inputType, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; inputType?: 'mobile' | 'number';
  required?: boolean;
}) {
  const type = inputType === 'mobile' ? 'mobile' : inputType === 'number' ? 'number' : multiline ? 'multiline' : 'text';
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

export default function AddReligiousScreen() {
  const { gpId, editId } = useLocalSearchParams<{ gpId: string; editId?: string }>();
  const isEdit = !!editId;

  const [form, setForm] = useState({ category: '', name: '', address: '', remarks: '' });
  const [authorityForm, setAuthorityForm] = useState({ name: '', address: '', mobile: '', alternate_mobile: '' });
  const [events, setEvents] = useState<ReligiousEvent[]>([]);
  const [newEvent, setNewEvent] = useState({ event_name: '', event_type: '', event_date: '', description: '', expected_crowd: '', remarks: '' });
  const [placeId, setPlaceId] = useState<string | null>(editId ?? null);
  const [saving, setSaving] = useState(false);
  const [savingAuthority, setSavingAuthority] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);

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
        const [place, authority, evts] = await Promise.all([
          getReligiousPlaceById(editId),
          getAuthorityByPlace(editId),
          getEventsByPlace(editId),
        ]);
        if (place) {
          setForm({ category: place.category, name: place.name, address: place.address ?? '', remarks: place.remarks ?? '' });
        }
        if (authority) {
          setAuthorityForm({ name: authority.name, address: authority.address ?? '', mobile: authority.mobile ?? '', alternate_mobile: authority.alternate_mobile ?? '' });
        }
        setEvents(evts);
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

  const update = (key: keyof typeof form) => (val: string) => { isDirty.current = true; setForm((p) => ({ ...p, [key]: val })); setError(''); };
  const updateAuth = (key: keyof typeof authorityForm) => (val: string) => { isDirty.current = true; setAuthorityForm((p) => ({ ...p, [key]: val })); };
  const updateEvent = (key: keyof typeof newEvent) => (val: string) => setNewEvent((p) => ({ ...p, [key]: val }));

  const handleSavePlaceAndAuthority = async () => {
    if (!form.category) { setError('Category is required'); return; }
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      let pid = placeId;
      if (!pid) {
        const created = await createReligiousPlace({
          gp_id: gpId!, category: form.category, name: form.name.trim(),
          address: form.address || undefined, remarks: form.remarks || undefined,
        });
        pid = created.id;
        setPlaceId(pid);
      } else {
        await updateReligiousPlace(pid, {
          category: form.category, name: form.name.trim(),
          address: form.address || undefined, remarks: form.remarks || undefined,
        });
      }
      if (authorityForm.name.trim()) {
        await upsertAuthority({
          place_id: pid!, authority_type: AUTHORITY_LABELS[form.category] ?? 'Responsible Person',
          name: authorityForm.name.trim(), address: authorityForm.address || undefined,
          mobile: authorityForm.mobile || undefined, alternate_mobile: authorityForm.alternate_mobile || undefined,
        });
      }
      if (!isEdit) { router.back(); return; }
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handleAddEvent = async () => {
    if (!placeId) { setError('Save the religious place first'); return; }
    if (!newEvent.event_name.trim()) { setError('Event name is required'); return; }
    if (!newEvent.event_type) { setError('Event type is required'); return; }
    setSavingEvent(true);
    try {
      const created = await createReligiousEvent({
        place_id: placeId, event_name: newEvent.event_name.trim(),
        event_type: newEvent.event_type, event_date: newEvent.event_date || undefined,
        description: newEvent.description || undefined,
        expected_crowd: newEvent.expected_crowd ? parseInt(newEvent.expected_crowd, 10) : undefined,
        remarks: newEvent.remarks || undefined,
      });
      setEvents((p) => [...p, created]);
      setNewEvent({ event_name: '', event_type: '', event_date: '', description: '', expected_crowd: '', remarks: '' });
      setShowEventForm(false);
    } catch { setError('Failed to add event.'); }
    setSavingEvent(false);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#2D52B8" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader title={isEdit ? 'Edit Religious Place' : 'Add Religious Place'}
        onBack={handleBackPress}
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1">

        <ScrollView contentContainerClassName="px-6 py-6 gap-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Place Details */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-foreground">Place Details</Text>
            <Dropdown label="Category *" value={form.category} options={RELIGIOUS_CATEGORIES} onSelect={update('category')} />
            <Field label="Name" value={form.name} onChange={update('name')} required />
            <Field label="Address" value={form.address} onChange={update('address')} placeholder="Village/area address" multiline />
            <Field label="Remarks" value={form.remarks} onChange={update('remarks')} multiline />
          </View>

          {/* Religious Authority */}
          {form.category ? (
            <View className="bg-accent/30 rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
              <Text className="text-sm font-semibold text-foreground">
                {AUTHORITY_LABELS[form.category] ?? 'Religious Authority'}
              </Text>
              <Field label="Name" value={authorityForm.name} onChange={updateAuth('name')} placeholder="Authority name" />
              <Field label="Address" value={authorityForm.address} onChange={updateAuth('address')} multiline />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Mobile" value={authorityForm.mobile} onChange={updateAuth('mobile')} inputType="mobile" />
                </View>
                <View className="flex-1">
                  <Field label="Alternate Mobile" value={authorityForm.alternate_mobile} onChange={updateAuth('alternate_mobile')} inputType="mobile" />
                </View>
              </View>
            </View>
          ) : null}

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable
            onPress={handleSavePlaceAndAuthority} disabled={saving}
            className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
            style={{ borderCurve: 'continuous' }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Religious Place'}
            </Text>
          </Pressable>

          {/* Religious Events (only when place exists) */}
          {(isEdit || placeId) ? (
            <View className="gap-4">
              <View className="h-px bg-border" />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">Religious Events ({events.length})</Text>
                <Pressable onPress={() => setShowEventForm(!showEventForm)} className="flex-row items-center gap-1 active:opacity-60">
                  <Plus size={14} color="#2D52B8" />
                  <Text className="text-sm text-primary font-medium">Add Event</Text>
                </Pressable>
              </View>

              {events.map((ev) => (
                <View key={ev.id} className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-start gap-3" style={{ borderCurve: 'continuous' }}>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{ev.event_name}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">{ev.event_type}{ev.event_date ? ` · ${ev.event_date}` : ''}</Text>
                    {ev.description ? <Text className="text-xs text-muted-foreground">{ev.description}</Text> : null}
                  </View>
                  <Pressable onPress={async () => { await deleteReligiousEvent(ev.id); setEvents((p) => p.filter((e) => e.id !== ev.id)); }} className="p-1.5 active:opacity-60">
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}

              {showEventForm && (
                <View className="bg-card border border-border rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
                  <Text className="text-sm font-semibold text-foreground">New Event</Text>
                  <Field label="Event Name" value={newEvent.event_name} onChange={updateEvent('event_name')} required />
                  <Dropdown label="Event Type *" value={newEvent.event_type} options={EVENT_TYPES} onSelect={updateEvent('event_type')} />
                  <Field label="Event Date" value={newEvent.event_date} onChange={updateEvent('event_date')} placeholder="e.g. 2025-03-15" />
                  <Field label="Description" value={newEvent.description} onChange={updateEvent('description')} multiline />
                  <Field label="Expected Crowd" value={newEvent.expected_crowd} onChange={updateEvent('expected_crowd')} inputType="number" />
                  <Pressable
                    onPress={handleAddEvent} disabled={savingEvent}
                    className="bg-accent rounded-xl py-3 items-center active:opacity-80"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-accent-foreground font-semibold text-sm">{savingEvent ? 'Adding…' : 'Add Event'}</Text>
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
