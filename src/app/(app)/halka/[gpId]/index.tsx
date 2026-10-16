import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus,
  Edit2, ChevronDown, ChevronRight, ChevronUp,
  Edit, Trash2, User, Users, Building2, Church, ShoppingBag,
  Home, Paperclip, Search, FileWarning,
} from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  getGramPanchayatById,
  deleteGramPanchayat,
  type GramPanchayat,
} from '@/lib/db/gramPanchayatRepo';
import { getHamletsByGP, deleteHamlet, type Hamlet } from '@/lib/db/hamletRepo';
import {
  getPersonsByType, deletePerson, type Person,
} from '@/lib/db/personRepo';
import {
  getReligiousPlacesByGP, deleteReligiousPlace, type ReligiousPlace,
} from '@/lib/db/religiousRepo';
import {
  getInstitutionsByGP, deleteInstitution, type SocialInstitution,
} from '@/lib/db/institutionRepo';
import {
  getShopsByGP, deleteShop, type LiquorShop,
} from '@/lib/db/liquorShopRepo';
import { PERSON_TYPES } from '@/lib/db/schema';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

type SectionKey =
  | 'hamlets' | 'current_pradhan' | 'former_pradhan' | 'bdc'
  | 'important' | 'religious' | 'institutions' | 'shops' | 'history_sheeter' | 'attachments';

interface Section {
  key: SectionKey;
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

const SECTIONS: Section[] = [
  { key: 'hamlets',         title: 'Hamlets / Majre',       icon: Home,         color: '#7C3AED' },
  { key: 'current_pradhan', title: 'Current Gram Pradhan',  icon: User,         color: '#2D52B8' },
  { key: 'former_pradhan',  title: 'Former Gram Pradhan',   icon: Users,        color: '#0891B2' },
  { key: 'bdc',             title: 'BDC Details',           icon: Users,        color: '#059669' },
  { key: 'important',       title: 'Important Persons',     icon: Users,        color: '#D97706' },
  { key: 'religious',       title: 'Religious Places',      icon: Church,       color: '#DC2626' },
  { key: 'institutions',    title: 'Social Institutions',   icon: Building2,    color: '#16a34a' },
  { key: 'shops',           title: 'Liquor & Beer Shops',   icon: ShoppingBag,  color: '#7C3AED' },
  { key: 'history_sheeter', title: 'History Sheeter (HS)',  icon: FileWarning,  color: '#B91C1C' },
  { key: 'attachments',     title: 'Attachments',           icon: Paperclip,    color: '#9CA3AF' },
];

function HSItem({ person, gpId, onDelete }: { person: Person; gpId: string; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mt-0.5">
          <FileWarning size={14} color="#B91C1C" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-foreground">{person.name}</Text>
          {person.category ? (
            <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: '#B91C1C18' }}>
              <Text className="text-xs font-medium" style={{ color: '#B91C1C' }}>HS# {person.category}</Text>
            </View>
          ) : null}
          {person.designation ? <Text className="text-xs text-muted-foreground">{person.designation}</Text> : null}
          {person.mobile ? <Text className="text-xs text-muted-foreground">{person.mobile}</Text> : null}
          {person.address ? <Text className="text-xs text-muted-foreground" numberOfLines={1}>{person.address}</Text> : null}
        </View>
        <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
          <Trash2 size={14} color="#DC2626" />
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.HISTORY_SHEETER}&editId=${person.id}` as never)}
        className="ml-11 mt-2 flex-row items-center gap-1 active:opacity-60"
      >
        <Edit size={12} color="#2D52B8" />
        <Text className="text-xs text-primary">Edit History Sheeter</Text>
      </Pressable>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}20` }}>
      <Text className="text-xs font-medium" style={{ color }}>{label}</Text>
    </View>
  );
}

function PersonItem({ person, onDelete }: { person: Person; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border flex-row items-start gap-3">
      <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mt-0.5">
        <User size={14} color="#6B7280" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{person.name}</Text>
        {person.category ? <Badge label={person.category} color="#2D52B8" /> : null}
        {person.mobile ? <Text className="text-xs text-muted-foreground mt-0.5">{person.mobile}</Text> : null}
        {person.address ? <Text className="text-xs text-muted-foreground">{person.address}</Text> : null}
      </View>
      <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
        <Trash2 size={14} color="#DC2626" />
      </Pressable>
    </View>
  );
}

function PlaceItem({ place, gpId, onDelete }: { place: ReligiousPlace; gpId: string; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mt-0.5">
          <Church size={14} color="#DC2626" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{place.name}</Text>
          <Badge label={place.category} color="#DC2626" />
          {place.address ? <Text className="text-xs text-muted-foreground mt-0.5">{place.address}</Text> : null}
        </View>
        <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
          <Trash2 size={14} color="#DC2626" />
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push(`/(app)/halka/${gpId}/add-religious?editId=${place.id}` as never)}
        className="ml-11 mt-2 flex-row items-center gap-1 active:opacity-60"
      >
        <Edit size={12} color="#2D52B8" />
        <Text className="text-xs text-primary">Manage Authority & Events</Text>
      </Pressable>
    </View>
  );
}

function InstitutionItem({ inst, gpId, onDelete }: { inst: SocialInstitution; gpId: string; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mt-0.5">
          <Building2 size={14} color="#16a34a" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{inst.name}</Text>
          <Badge label={inst.category} color="#16a34a" />
          {inst.address ? <Text className="text-xs text-muted-foreground mt-0.5">{inst.address}</Text> : null}
        </View>
        <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
          <Trash2 size={14} color="#DC2626" />
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push(`/(app)/halka/${gpId}/add-institution?editId=${inst.id}` as never)}
        className="ml-11 mt-2 flex-row items-center gap-1 active:opacity-60"
      >
        <Edit size={12} color="#2D52B8" />
        <Text className="text-xs text-primary">Manage Head & Staff</Text>
      </Pressable>
    </View>
  );
}

function ShopItem({ shop, onDelete }: { shop: LiquorShop; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border flex-row items-start gap-3">
      <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mt-0.5">
        <ShoppingBag size={14} color="#7C3AED" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{shop.shop_name}</Text>
        <Badge label={shop.shop_type} color="#7C3AED" />
        <Text className="text-xs text-muted-foreground mt-0.5">Owner: {shop.owner_name}</Text>
        {shop.mobile ? <Text className="text-xs text-muted-foreground">{shop.mobile}</Text> : null}
      </View>
      <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
        <Trash2 size={14} color="#DC2626" />
      </Pressable>
    </View>
  );
}

function HamletItem({ hamlet, onDelete }: { hamlet: Hamlet; onDelete: () => void }) {
  return (
    <View className="py-3 border-b border-border flex-row items-center gap-3">
      <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center">
        <Home size={14} color="#7C3AED" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{hamlet.name}</Text>
        {hamlet.population ? (
          <Text className="text-xs text-muted-foreground">Population: {hamlet.population}</Text>
        ) : null}
      </View>
      <Pressable onPress={onDelete} className="p-1.5 active:opacity-60">
        <Trash2 size={14} color="#DC2626" />
      </Pressable>
    </View>
  );
}

interface SectionData {
  hamlets: Hamlet[];
  currentPradhan: Person[];
  formerPradhan: Person[];
  bdc: Person[];
  important: Person[];
  religiousPlaces: ReligiousPlace[];
  institutions: SocialInstitution[];
  shops: LiquorShop[];
  historySheeters: Person[];
}

export default function GPDetailScreen() {
  const { gpId, section } = useLocalSearchParams<{ gpId: string; section?: string }>();

  // If navigated from analytics-list with a ?section= param, open that section.
  // Otherwise default to 'hamlets'.
  const initialSection = (section as SectionKey | undefined) ?? 'hamlets';

  const [gp, setGp] = useState<GramPanchayat | null>(null);
  const [data, setData] = useState<SectionData>({
    hamlets: [], currentPradhan: [], formerPradhan: [],
    bdc: [], important: [], religiousPlaces: [], institutions: [], shops: [],
    historySheeters: [],
  });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set([initialSection]));

  // "How many HS?" prompt state
  const [hsCountPrompt, setHsCountPrompt] = useState(false);
  const [hsCount, setHsCount] = useState('1');

  const loadData = useCallback(async () => {
    if (!gpId) return;
    setLoading(true);
    try {
      const [gpData, hamlets, current, former, bdc, important, religious, insts, shops, hs] = await Promise.all([
        getGramPanchayatById(gpId),
        getHamletsByGP(gpId),
        getPersonsByType(gpId, PERSON_TYPES.CURRENT_PRADHAN),
        getPersonsByType(gpId, PERSON_TYPES.FORMER_PRADHAN),
        getPersonsByType(gpId, PERSON_TYPES.BDC),
        getPersonsByType(gpId, PERSON_TYPES.IMPORTANT),
        getReligiousPlacesByGP(gpId),
        getInstitutionsByGP(gpId),
        getShopsByGP(gpId),
        getPersonsByType(gpId, PERSON_TYPES.HISTORY_SHEETER),
      ]);
      setGp(gpData);
      setData({ hamlets, currentPradhan: current, formerPradhan: former, bdc, important, religiousPlaces: religious, institutions: insts, shops, historySheeters: hs });
    } catch (e) {
      logger.warn('[GPDetail] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, [gpId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const toggle = (key: SectionKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getCount = (key: SectionKey): number => {
    const m: Record<SectionKey, number> = {
      hamlets: data.hamlets.length,
      current_pradhan: data.currentPradhan.length,
      former_pradhan: data.formerPradhan.length,
      bdc: data.bdc.length,
      important: data.important.length,
      religious: data.religiousPlaces.length,
      institutions: data.institutions.length,
      shops: data.shops.length,
      history_sheeter: data.historySheeters.length,
      attachments: 0,
    };
    return m[key];
  };

  const handleAddForSection = (key: SectionKey) => {
    if (!gpId) return;
    switch (key) {
      case 'hamlets':
        router.push(`/(app)/halka/${gpId}/add-hamlet` as never); break;
      case 'current_pradhan':
        router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.CURRENT_PRADHAN}` as never); break;
      case 'former_pradhan':
        router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.FORMER_PRADHAN}` as never); break;
      case 'bdc':
        router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.BDC}` as never); break;
      case 'important':
        router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.IMPORTANT}` as never); break;
      case 'religious':
        router.push(`/(app)/halka/${gpId}/add-religious` as never); break;
      case 'institutions':
        router.push(`/(app)/halka/${gpId}/add-institution` as never); break;
      case 'shops':
        router.push(`/(app)/halka/${gpId}/add-shop` as never); break;
      case 'history_sheeter':
        setHsCount('1');
        setHsCountPrompt(true);
        break;
    }
  };

  const renderSectionContent = (key: SectionKey) => {
    switch (key) {
      case 'hamlets':
        return data.hamlets.map((h) => (
          <HamletItem key={h.id} hamlet={h} onDelete={async () => { await deleteHamlet(h.id); loadData(); }} />
        ));
      case 'current_pradhan':
      case 'former_pradhan':
      case 'bdc':
      case 'important': {
        const list = key === 'current_pradhan' ? data.currentPradhan
          : key === 'former_pradhan' ? data.formerPradhan
          : key === 'bdc' ? data.bdc : data.important;
        return list.map((p) => (
          <PersonItem key={p.id} person={p} onDelete={async () => { await deletePerson(p.id); loadData(); }} />
        ));
      }
      case 'religious':
        return data.religiousPlaces.map((rp) => (
          <PlaceItem key={rp.id} place={rp} gpId={gpId!} onDelete={async () => { await deleteReligiousPlace(rp.id); loadData(); }} />
        ));
      case 'institutions':
        return data.institutions.map((i) => (
          <InstitutionItem key={i.id} inst={i} gpId={gpId!} onDelete={async () => { await deleteInstitution(i.id); loadData(); }} />
        ));
      case 'shops':
        return data.shops.map((s) => (
          <ShopItem key={s.id} shop={s} onDelete={async () => { await deleteShop(s.id); loadData(); }} />
        ));
      case 'history_sheeter':
        return data.historySheeters.map((p) => (
          <HSItem key={p.id} person={p} gpId={gpId!} onDelete={async () => { await deletePerson(p.id); loadData(); }} />
        ));
      case 'attachments':
        return (
          <View className="py-4 items-center">
            <Text className="text-sm text-muted-foreground">Attachment engine integration coming soon</Text>
          </View>
        );
    }
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
      <AppHeader
        title={gp?.name ?? 'Gram Panchayat'}
        subtitle="My Halka"
        showBack
        actions={
          <HeaderIconBtn icon={Edit2} onPress={() => router.push(`/(app)/halka/add-gp?editId=${gpId}` as never)} label="Edit GP" />
        }
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {gp?.remarks ? (
          <Text className="text-xs text-muted-foreground ml-1">{gp.remarks}</Text>
        ) : null}
      </View>

      {/* Accordion Sections */}
      <ScrollView
        contentContainerClassName="px-6 py-5 gap-3"
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isOpen = expanded.has(section.key);
          const count = getCount(section.key);

          return (
            <View
              key={section.key}
              className="bg-card border border-border rounded-2xl overflow-hidden"
              style={{ borderCurve: 'continuous' }}
            >
              {/* Section Header */}
              <Pressable
                onPress={() => toggle(section.key)}
                className="px-4 py-4 flex-row items-center gap-3 active:opacity-70"
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${section.color}18` }}
                >
                  <Icon size={18} color={section.color} />
                </View>
                <Text className="flex-1 text-sm font-semibold text-foreground">{section.title}</Text>
                {count > 0 && (
                  <View className="bg-primary rounded-full w-5 h-5 items-center justify-center">
                    <Text className="text-xs text-primary-foreground font-bold">{count}</Text>
                  </View>
                )}
                {isOpen ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
              </Pressable>

              {/* Section Content */}
              {isOpen && (
                <View className="px-4 pb-4 border-t border-border">
                  {section.key !== 'attachments' && (
                    <Pressable
                      onPress={() => handleAddForSection(section.key)}
                      className="flex-row items-center gap-2 py-3 active:opacity-60"
                    >
                      <Plus size={15} color="#2D52B8" />
                      <Text className="text-sm text-primary font-medium">Add {section.title}</Text>
                    </Pressable>
                  )}
                  {renderSectionContent(section.key)}
                  {count === 0 && section.key !== 'attachments' && (
                    <Text className="text-xs text-muted-foreground py-3 text-center">
                      No {section.title.toLowerCase()} added yet
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View className="h-8" />
      </ScrollView>

      {/* "How many HS?" prompt */}
      <AlertDialog open={hsCountPrompt} onOpenChange={(v) => { if (!v) setHsCountPrompt(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add History Sheeters</AlertDialogTitle>
            <AlertDialogDescription>
              How many History Sheeters do you want to add?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Counter row */}
          <View className="flex-row items-center justify-center gap-5 py-2">
            <Pressable
              onPress={() => setHsCount((v) => String(Math.max(1, parseInt(v || '1', 10) - 1)))}
              className="w-10 h-10 rounded-xl bg-secondary items-center justify-center active:opacity-60"
            >
              <Text className="text-xl font-bold text-foreground">−</Text>
            </Pressable>
            <Input
              type="number"
              value={hsCount}
              onChangeText={setHsCount}
              maxLength={2}
              style={{ width: 56 }}
            />
            <Pressable
              onPress={() => setHsCount((v) => String(Math.min(10, parseInt(v || '1', 10) + 1)))}
              className="w-10 h-10 rounded-xl bg-secondary items-center justify-center active:opacity-60"
            >
              <Text className="text-xl font-bold text-foreground">+</Text>
            </Pressable>
          </View>

          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setHsCountPrompt(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => {
                setHsCountPrompt(false);
                const n = Math.min(Math.max(parseInt(hsCount || '1', 10) || 1, 1), 10);
                router.push(`/(app)/halka/${gpId}/add-person?type=${PERSON_TYPES.HISTORY_SHEETER}&count=${n}` as never);
              }}
            >
              <Text className="text-primary-foreground font-semibold">Continue</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
