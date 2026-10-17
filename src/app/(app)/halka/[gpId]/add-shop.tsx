import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Save, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import {
  createShop, getShopById, updateShop,
  getStaffByShop, createShopStaff, deleteShopStaff,
  type ShopStaff,
} from '@/lib/db/liquorShopRepo';
import { SHOP_TYPES } from '@/lib/db/schema';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// Field — label + Input wrapper used by add-shop
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

export default function AddShopScreen() {
  const { t } = useTranslation();
  const { gpId, editId } = useLocalSearchParams<{ gpId: string; editId?: string }>();
  const isEdit = !!editId;

  const [form, setForm] = useState({
    shop_name: '', shop_type: '', owner_name: '', address: '',
    mobile: '', alternate_mobile: '', licence_number: '',
  });
  const [showTypes, setShowTypes] = useState(false);
  const [staff, setStaff] = useState<ShopStaff[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', mobile: '' });
  const [shopId, setShopId] = useState<string | null>(editId ?? null);
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
        const [shop, staffList] = await Promise.all([getShopById(editId), getStaffByShop(editId)]);
        if (shop) {
          setForm({
            shop_name: shop.shop_name, shop_type: shop.shop_type, owner_name: shop.owner_name,
            address: shop.address ?? '', mobile: shop.mobile ?? '',
            alternate_mobile: shop.alternate_mobile ?? '', licence_number: shop.licence_number ?? '',
          });
        }
        setStaff(staffList);
        setLoading(false);
      })();
    }
  }, [isEdit, editId]));

  const update = (k: keyof typeof form) => (v: string) => { isDirty.current = true; setForm((p) => ({ ...p, [k]: v })); setError(''); };

  const handleSave = async () => {
    if (!form.shop_name.trim()) { setError(t('halka.shop.errorNameRequired')); return; }
    if (!form.shop_type) { setError(t('halka.shop.errorTypeRequired')); return; }
    if (!form.owner_name.trim()) { setError(t('halka.shop.errorOwnerRequired')); return; }
    setSaving(true);
    try {
      let sid = shopId;
      if (!sid) {
        const created = await createShop({
          gp_id: gpId!, shop_name: form.shop_name.trim(), shop_type: form.shop_type,
          owner_name: form.owner_name.trim(), address: form.address || undefined,
          mobile: form.mobile || undefined, alternate_mobile: form.alternate_mobile || undefined,
          licence_number: form.licence_number || undefined,
        });
        sid = created.id;
        setShopId(sid);
      } else {
        await updateShop(sid, {
          shop_name: form.shop_name.trim(), shop_type: form.shop_type, owner_name: form.owner_name.trim(),
          address: form.address || undefined, mobile: form.mobile || undefined,
          alternate_mobile: form.alternate_mobile || undefined, licence_number: form.licence_number || undefined,
        });
      }
      if (!isEdit) { router.back(); return; }
    } catch { setError(t('halka.shop.errorSaveFailed')); }
    setSaving(false);
  };

  const handleAddStaff = async () => {
    if (!shopId) { setError(t('halka.shop.errorSaveShopFirst')); return; }
    if (!newStaff.name.trim()) { setError(t('halka.shop.errorStaffNameRequired')); return; }
    setSavingStaff(true);
    try {
      const created = await createShopStaff({ shop_id: shopId!, name: newStaff.name.trim(), mobile: newStaff.mobile || undefined });
      setStaff((p) => [...p, created]);
      setNewStaff({ name: '', mobile: '' });
      setShowStaffForm(false);
    } catch { setError(t('halka.shop.errorAddStaffFailed')); }
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

      <AppHeader title={isEdit ? t('halka.shop.editTitle') : t('halka.shop.addTitle')} onBack={handleBackPress} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">

        <ScrollView contentContainerClassName="px-6 py-6 gap-5" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Shop Type */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.shop.fieldShopType')} <Text className="text-destructive">*</Text></Text>
            <Pressable onPress={() => setShowTypes(!showTypes)} className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between bg-card active:opacity-70" style={{ borderCurve: 'continuous' }}>
              <Text className={form.shop_type ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>{form.shop_type || t('halka.shop.placeholderShopType')}</Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </Pressable>
            {showTypes && (
              <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderCurve: 'continuous' }}>
                {SHOP_TYPES.map((tVal) => (
                  <Pressable key={tVal} onPress={() => { update('shop_type')(tVal); setShowTypes(false); }} className="px-4 py-3 border-b border-border last:border-b-0 active:bg-secondary">
                    <Text className={`text-base ${form.shop_type === tVal ? 'text-primary font-medium' : 'text-foreground'}`}>{tVal}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Field label={t('halka.shop.fieldName')} value={form.shop_name} onChange={update('shop_name')} required />
          <Field label={t('halka.shop.fieldOwner')} value={form.owner_name} onChange={update('owner_name')} required />
          <Field label={t('halka.shop.fieldAddress')} value={form.address} onChange={update('address')} multiline />

          <View className="flex-row gap-3">
            <View className="flex-1"><Field label={t('halka.person.fieldMobile')} value={form.mobile} onChange={update('mobile')} inputType="mobile" /></View>
            <View className="flex-1"><Field label={t('halka.person.fieldAltMobile')} value={form.alternate_mobile} onChange={update('alternate_mobile')} inputType="mobile" /></View>
          </View>

          <Field label={t('halka.shop.fieldLicence')} value={form.licence_number} onChange={update('licence_number')} placeholder={t('halka.shop.placeholderLicence')} />

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80" style={{ borderCurve: 'continuous' }}>
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">{saving ? t('common.saving') : isEdit ? t('common.update') : t('halka.shop.btnSave')}</Text>
          </Pressable>

          {/* Staff */}
          {(isEdit || shopId) ? (
            <View className="gap-4">
              <View className="h-px bg-border" />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">{t('halka.shop.staffCount', { count: staff.length })}</Text>
                <Pressable onPress={() => setShowStaffForm(!showStaffForm)} className="flex-row items-center gap-1 active:opacity-60">
                  <Plus size={14} color="#2D52B8" />
                  <Text className="text-sm text-primary font-medium">{t('halka.shop.btnAddStaff')}</Text>
                </Pressable>
              </View>

              {staff.map((s) => (
                <View key={s.id} className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-3" style={{ borderCurve: 'continuous' }}>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                    {s.mobile ? <Text className="text-xs text-muted-foreground">{s.mobile}</Text> : null}
                  </View>
                  <Pressable onPress={async () => { await deleteShopStaff(s.id); setStaff((p) => p.filter((x) => x.id !== s.id)); }} className="p-1.5 active:opacity-60">
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}

              {showStaffForm && (
                <View className="bg-card border border-border rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
                  <Text className="text-sm font-semibold text-foreground">{t('halka.shop.newStaffTitle')}</Text>
                  <Field label={t('halka.person.fieldName')} value={newStaff.name} onChange={(v) => setNewStaff((p) => ({ ...p, name: v }))} required />
                  <Field label={t('halka.person.fieldMobile')} value={newStaff.mobile} onChange={(v) => setNewStaff((p) => ({ ...p, mobile: v }))} inputType="mobile" />
                  <Pressable onPress={handleAddStaff} disabled={savingStaff} className="bg-accent rounded-xl py-3 items-center active:opacity-80" style={{ borderCurve: 'continuous' }}>
                    <Text className="text-accent-foreground font-semibold text-sm">{savingStaff ? t('common.saving') : t('halka.shop.btnAddStaffMember')}</Text>
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
