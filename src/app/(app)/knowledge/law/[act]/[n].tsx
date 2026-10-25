import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Share, Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Copy, Share2, ChevronLeft, ChevronRight, Check,
  AlertTriangle, ShieldCheck, Landmark, Layers,
  ChevronDown, ChevronUp, Link2, ArrowLeftRight, X,
} from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import {
  ACTS, getSection, getOffenceClassification,
  getLinks, getLinkCounts,
  type ActId, type ClassificationRow, type LawLinkItem,
} from '@/lib/law/lawLibrary';
import { getSimple, type SimpleExplainEntry } from '@/lib/law/simpleExplain';
import { getDetailedExplain, type DetailedExplainEntry } from '@/lib/law/detailedAnalysis';
import { getCasesForSection, type CaseLawItem } from '@/lib/law/casesData';
import { DetailedAnalysisCard } from '@/components/law/DetailedAnalysisCard';
import { CaseLawCard } from '@/components/law/CaseLawCard';
import { openSection } from '@/lib/law/openLaw';
import { formatSectionSafe } from '@/lib/law/formatSection';
import { SectionBody } from '@/components/law/SectionBody';
import {
  getOldLawForNew,
  getNewSectionsForOld,
  type OldLawReference,
} from '@/lib/law/lawMapping';
import {
  getReaderFontSize,
  saveReaderFontSize,
  resetReaderFontSize,
  DEFAULT_READER_FONT_SIZE,
  MIN_READER_FONT_SIZE,
  MAX_READER_FONT_SIZE,
} from '@/lib/law/readerFontPreference';

export default function LawSectionDetailScreen() {
  const params = useLocalSearchParams<{ act: string; n: string }>();
  const actParam = (params.act?.toUpperCase() || 'BNS') as ActId;
  const actId: ActId = (actParam in ACTS) ? actParam : 'BNS';
  const meta = ACTS[actId];
  const sectionNum = parseInt(params.n || '1', 10);

  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isHi = i18n.language === 'hi';
  const isDark = colorScheme === 'dark';

  // Font size scaling (A- / A+): 12px to 22px, default 14px (Task L21b)
  const [fontSize, setFontSize] = useState<number>(DEFAULT_READER_FONT_SIZE);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    getReaderFontSize().then((size) => {
      if (mounted) setFontSize(size);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDecreaseFontSize = useCallback(() => {
    setFontSize((current) => {
      const next = Math.max(MIN_READER_FONT_SIZE, current - 1);
      saveReaderFontSize(next);
      return next;
    });
  }, []);

  const handleIncreaseFontSize = useCallback(() => {
    setFontSize((current) => {
      const next = Math.min(MAX_READER_FONT_SIZE, current + 1);
      saveReaderFontSize(next);
      return next;
    });
  }, []);

  const handleResetFontSize = useCallback(() => {
    resetReaderFontSize().then((size) => {
      setFontSize(size);
    });
  }, []);

  // Old Law <-> New Law mapping & sheet modal
  const oldLawRef = useMemo(() => getOldLawForNew(actId, sectionNum), [actId, sectionNum]);
  const [oldLawModalOpen, setOldLawModalOpen] = useState(false);
  const [activeOldSec, setActiveOldSec] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const classificationCardYRef = useRef<number>(0);
  const relatedCardYRef = useRef<number>(0);

  const section = useMemo(() => getSection(actId, sectionNum), [actId, sectionNum]);

  // Simple explanation ("सरल भाषा में") if available
  const simpleExplain: SimpleExplainEntry | null = useMemo(
    () => getSimple(actId, sectionNum),
    [actId, sectionNum]
  );
  const [simpleExpanded, setSimpleExpanded] = useState<boolean>(true);

  // Detailed analysis ("विस्तृत विश्लेषण") if available
  const detailedExplain: DetailedExplainEntry | null = useMemo(
    () => getDetailedExplain(actId, sectionNum),
    [actId, sectionNum]
  );

  // Verified case law ("महत्वपूर्ण निर्णय") if available
  const cases: CaseLawItem[] = useMemo(
    () => getCasesForSection(actId, sectionNum),
    [actId, sectionNum]
  );

  // Cross-links and cited-by references
  const links = useMemo(() => getLinks(actId, sectionNum), [actId, sectionNum]);
  const linkCounts = useMemo(() => getLinkCounts(actId, sectionNum), [actId, sectionNum]);
  const [showAllRefs, setShowAllRefs] = useState<boolean>(false);
  const [showAllCitedBy, setShowAllCitedBy] = useState<boolean>(false);

  const scrollToRelated = useCallback(() => {
    if (relatedCardYRef.current > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: relatedCardYRef.current - 12, animated: true });
    }
  }, []);

  // Structured blocks parsed via formatSectionSafe with self-check integrity
  const blocks = useMemo(() => {
    if (!section) return [];
    return formatSectionSafe(section.text, `${actId} ${section.n}`);
  }, [actId, section]);

  // Offence classification for BNS sections (BNSS Schedule I)
  const classificationRows: ClassificationRow[] = useMemo(() => {
    if (actId !== 'BNS' || !section) return [];
    return getOffenceClassification(section.n);
  }, [actId, section]);

  const actColor = actId === 'BNS' ? '#1D4ED8' : actId === 'BNSS' ? '#0F766E' : '#B45309';

  const handleCopyCitation = useCallback(async () => {
    if (!section) return;
    const citationText = `${actId} ${section.n} — ${section.title}\n\n${section.text}\n\nSource: Official gazette`;
    await Clipboard.setStringAsync(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [actId, section]);

  const handleShare = useCallback(async () => {
    if (!section) return;
    const shareText = `${actId} ${section.n} — ${section.title}\n\n${section.text}\n\nSource: Official gazette`;
    await Share.share({
      title: `${actId} Section ${section.n}`,
      message: shareText,
    }).catch(() => {});
  }, [actId, section]);

  const handlePrev = useCallback(() => {
    if (sectionNum > 1) {
      router.replace(`/(app)/knowledge/law/${actId}/${sectionNum - 1}` as never);
    }
  }, [actId, sectionNum]);

  const handleNext = useCallback(() => {
    if (sectionNum < meta.total) {
      router.replace(`/(app)/knowledge/law/${actId}/${sectionNum + 1}` as never);
    }
  }, [actId, sectionNum, meta.total]);

  const scrollToClassification = useCallback(() => {
    if (scrollViewRef.current && classificationCardYRef.current > 0) {
      scrollViewRef.current.scrollTo({
        y: classificationCardYRef.current - 20,
        animated: true,
      });
    }
  }, []);

  if (!section) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={`${actId} ${sectionNum}`} showBack />
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text className="text-base font-semibold text-foreground">
            {t('knowledge.law.noSections', 'धारा नहीं मिली')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-primary"
            style={{ borderCurve: 'continuous', minHeight: 44 }}
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              {t('checklists.goBack', 'वापस जाएं')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Quick classification chips for single BNS row
  const singleRow = classificationRows.length === 1 ? classificationRows[0] : null;
  const isMultipleClassification = classificationRows.length > 1;

  const isCognizable = singleRow ? !/non-cognizable|असंज्ञेय/i.test(singleRow.cognizable) : true;
  const isBailable = singleRow ? /bailable|जमानती/i.test(singleRow.bailable) && !/non-bailable|अजमानती/i.test(singleRow.bailable) : false;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={`${actId} ${isHi ? `धारा ${section.n}` : `Section ${section.n}`}`}
        subtitle={isHi ? meta.shortHi : meta.nameEn}
        showBack
      />

      {/* Floating Toolbar: A- / A+, Copy, Share */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border bg-card">
        {/* Font scale buttons */}
        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={handleDecreaseFontSize}
            className="w-9 h-9 rounded-lg border border-border items-center justify-center active:opacity-70 bg-background"
            style={{ borderCurve: 'continuous', minHeight: 44, minWidth: 44 }}
            accessibilityLabel="Decrease font size"
            disabled={fontSize <= MIN_READER_FONT_SIZE}
          >
            <Text className={`text-sm font-bold ${fontSize <= MIN_READER_FONT_SIZE ? 'text-muted-foreground/30' : 'text-foreground'}`}>A−</Text>
          </Pressable>
          <Pressable
            onPress={handleIncreaseFontSize}
            className="w-9 h-9 rounded-lg border border-border items-center justify-center active:opacity-70 bg-background"
            style={{ borderCurve: 'continuous', minHeight: 44, minWidth: 44 }}
            accessibilityLabel="Increase font size"
            disabled={fontSize >= MAX_READER_FONT_SIZE}
          >
            <Text className={`text-base font-bold ${fontSize >= MAX_READER_FONT_SIZE ? 'text-muted-foreground/30' : 'text-foreground'}`}>A+</Text>
          </Pressable>
          <Pressable
            onPress={handleResetFontSize}
            className="px-2 py-1.5 rounded-lg border border-border/60 items-center justify-center active:opacity-60 bg-muted/30 ml-1"
            style={{ borderCurve: 'continuous', minHeight: 36, minWidth: 44 }}
            accessibilityRole="button"
            accessibilityLabel={`Font size ${fontSize}px, tap to reset to 14px`}
          >
            <Text className="text-xs font-semibold text-foreground">
              {fontSize}px
            </Text>
          </Pressable>
        </View>

        {/* Action buttons: Copy & Share */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleCopyCitation}
            className="flex-row items-center gap-1.5 px-3 h-10 rounded-xl border border-border bg-background active:opacity-70"
            style={{ borderCurve: 'continuous', minHeight: 44 }}
          >
            {copied ? (
              <>
                <Check size={16} color="#059669" />
                <Text className="text-xs font-semibold text-emerald-600">
                  {t('knowledge.law.copied', 'कॉपी!')}
                </Text>
              </>
            ) : (
              <>
                <Copy size={16} color={C.mutedForeground} />
                <Text className="text-xs font-semibold text-foreground">
                  {t('knowledge.law.copyCitation', 'कॉपी')}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleShare}
            className="w-10 h-10 rounded-xl border border-border items-center justify-center bg-background active:opacity-70"
            style={{ borderCurve: 'continuous', minHeight: 44, minWidth: 44 }}
            accessibilityLabel="Share section"
          >
            <Share2 size={16} color={C.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Main Content Area: flex:1 so bottom footer sits naturally below it */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          padding: 12,
          gap: 12,
          paddingBottom: 24,
        }}
      >
        {/* ── Modernized Header Card ── */}
        <View
          className="bg-card border border-border rounded-2xl shadow-sm shadow-black/5"
          style={{ padding: 12, gap: 10, borderCurve: 'continuous' }}
        >
          {/* Row 1: Act Chip (BNS/BNSS/BSA) + Act Full Name (allows 2-line wrap, flex: 1) */}
          <View className="flex-row items-center gap-2">
            <View
              className="rounded-full items-center justify-center px-2.5 py-1"
              style={{ backgroundColor: `${actColor}15`, borderCurve: 'continuous' }}
            >
              <Text textBreakStrategy="simple" style={{ fontSize: 12, fontWeight: '700', color: actColor }}>
                {actId}
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, fontWeight: '500', lineHeight: 16, color: C.mutedForeground, flex: 1 }}
              numberOfLines={2}
            >
              {isHi ? meta.nameHi : meta.nameEn}
            </Text>
          </View>

          {/* Row 2: Small muted line on its OWN line (no collision with Act Name) */}
          <Text style={{ fontSize: 12, fontWeight: '500', lineHeight: 16, color: C.mutedForeground }}>
            {isHi ? 'आधिकारिक गजट पाठ · अंग्रेज़ी' : 'Official gazette text · English'}
          </Text>

          {/* Row 3: 'Section N' tied to B+6 (20 when B=14), title tied to B+1 (15 when B=14) */}
          <View className="gap-1 pt-0.5">
            <Text
              style={{
                fontSize: fontSize + 6,
                lineHeight: Math.round((fontSize + 6) * 1.3),
                fontWeight: '700',
                color: C.foreground,
                letterSpacing: -0.2,
              }}
            >
              {isHi ? `धारा ${section.n}` : `Section ${section.n}`}
            </Text>
            <Text
              style={{
                fontSize: fontSize + 1,
                lineHeight: Math.round((fontSize + 1) * 1.4),
                fontWeight: '500',
                color: C.foreground,
                opacity: 0.9,
              }}
              numberOfLines={2}
            >
              {section.title}
            </Text>

            {/* Old Law Mapping Chip Row */}
            {oldLawRef.displayText ? (
              <View className="flex-row flex-wrap items-center gap-2 pt-2">
                {oldLawRef.isNewProvision ? (
                  <Pressable
                    onPress={() => {
                      setActiveOldSec(null);
                      setOldLawModalOpen(true);
                    }}
                    className="flex-row items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 active:opacity-70 px-3 py-1.5"
                    style={{ borderCurve: 'continuous', minHeight: 32 }}
                    accessibilityRole="button"
                    accessibilityLabel="नया प्रावधान"
                  >
                    <Text textBreakStrategy="simple" className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      नया प्रावधान
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setActiveOldSec(oldLawRef.oldSections[0] || null);
                      setOldLawModalOpen(true);
                    }}
                    className="flex-row items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 active:opacity-70 px-3 py-1.5"
                    style={{ borderCurve: 'continuous', minHeight: 32 }}
                    accessibilityRole="button"
                    accessibilityLabel={oldLawRef.displayText}
                  >
                    <ArrowLeftRight size={13} color="#D97706" />
                    <Text textBreakStrategy="simple" className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {oldLawRef.displayText}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>

          {/* Quick Statutory Classification & Links Pills */}
          {(actId === 'BNS' || linkCounts.total > 0) && (
            <View className="pt-2 border-t border-border/50 flex-row flex-wrap items-center gap-2">
              {actId === 'BNS' && (
                <>
                  {isMultipleClassification ? (
                    <Pressable
                      onPress={scrollToClassification}
                      className="flex-row items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 active:opacity-70 px-3 py-1.5"
                      style={{ borderCurve: 'continuous', minHeight: 34 }}
                    >
                      <Layers size={14} color={C.primary} />
                      <Text textBreakStrategy="simple" className="text-xs font-bold text-primary">
                        {isHi ? 'कई उप-धाराएँ (विवरण देखें)' : 'Multiple Sub-Sections (View Below)'}
                      </Text>
                    </Pressable>
                  ) : singleRow ? (
                    <>
                      {/* Cognizable Pill */}
                      <View
                        className="flex-row items-center gap-1 rounded-full border px-2.5 py-1"
                        style={{
                          backgroundColor: isCognizable
                            ? (isDark ? '#7C2D1225' : '#FFF7ED')
                            : (isDark ? '#1E3A8A25' : '#EFF6FF'),
                          borderColor: isCognizable
                            ? (isDark ? '#EA580C80' : '#FDBA74')
                            : (isDark ? '#3B82F680' : '#BFDBFE'),
                          borderCurve: 'continuous',
                        }}
                      >
                        <AlertTriangle
                          size={12}
                          color={isCognizable ? '#EA580C' : '#3B82F6'}
                        />
                        <Text textBreakStrategy="simple"
                          className="text-xs font-bold"
                          style={{ color: isCognizable ? '#EA580C' : '#2563EB' }}
                        >
                          {singleRow.cognizable || (isCognizable ? 'संज्ञेय' : 'असंज्ञेय')}
                        </Text>
                      </View>

                      {/* Bailable Pill */}
                      <View
                        className="flex-row items-center gap-1 rounded-full border px-2.5 py-1"
                        style={{
                          backgroundColor: isBailable
                            ? (isDark ? '#064E3B25' : '#ECFDF5')
                            : (isDark ? '#7F1D1D25' : '#FEF2F2'),
                          borderColor: isBailable
                            ? (isDark ? '#05966980' : '#A7F3D0')
                            : (isDark ? '#DC262680' : '#FECACA'),
                          borderCurve: 'continuous',
                        }}
                      >
                        <ShieldCheck
                          size={12}
                          color={isBailable ? '#059669' : '#DC2626'}
                        />
                        <Text textBreakStrategy="simple"
                          className="text-xs font-bold"
                          style={{ color: isBailable ? '#059669' : '#DC2626' }}
                        >
                          {singleRow.bailable || (isBailable ? 'जमानती' : 'अजमानती')}
                        </Text>
                      </View>

                      {/* Court Pill */}
                      {singleRow.court ? (
                        <View
                          className="flex-row items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1"
                          style={{ borderCurve: 'continuous' }}
                        >
                          <Landmark size={12} color={C.mutedForeground} />
                          <Text textBreakStrategy="simple" className="text-xs font-semibold text-foreground">
                            {singleRow.court}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}

              {/* A3: Header quick row: small pill 'संबंधित (n)' when total > 0 */}
              {linkCounts.total > 0 && (
                <Pressable
                  onPress={scrollToRelated}
                  className="flex-row items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 active:opacity-70 px-3 py-1.5"
                  style={{ borderCurve: 'continuous', minHeight: 34 }}
                >
                  <Link2 size={13} color={C.primary} />
                  <Text textBreakStrategy="simple" className="text-xs font-bold text-primary">
                    {isHi ? `संबंधित (${linkCounts.total})` : `Related (${linkCounts.total})`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* ── B2: 'सरल भाषा में' Simple Explanation Card (ABOVE official text) ── */}
        {simpleExplain ? (
          <View
            className="p-5 bg-card border border-border rounded-2xl shadow-sm shadow-black/5 gap-3.5"
            style={{ borderCurve: 'continuous' }}
          >
            {/* Header: Title + Badge + Collapse Chevron */}
            <Pressable
              onPress={() => setSimpleExpanded((prev) => !prev)}
              className="flex-row items-center justify-between active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="सरल भाषा में व्याख्या"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-[15px] font-bold text-foreground">
                  {isHi ? 'सरल भाषा में' : 'Simple Explanation'}
                </Text>
                <View
                  className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Text textBreakStrategy="simple" className="text-[11px] font-bold text-primary">
                    {isHi ? 'सहायक व्याख्या' : 'Aide / Guide'}
                  </Text>
                </View>
              </View>
              {simpleExpanded ? (
                <ChevronUp size={18} color={C.mutedForeground} />
              ) : (
                <ChevronDown size={18} color={C.mutedForeground} />
              )}
            </Pressable>

            {simpleExpanded && (
              <View className="gap-3.5 pt-1">
                {/* (a) Summary `s` bold */}
                <Text className="text-sm font-bold text-foreground leading-6">
                  {simpleExplain.s}
                </Text>

                {/* (b) Bullet list `k` with hanging indent */}
                {Array.isArray(simpleExplain.k) && simpleExplain.k.length > 0 && (
                  <View className="gap-2 pl-0.5">
                    {simpleExplain.k.map((point, kIdx) => (
                      <View key={kIdx} className="flex-row items-start gap-2">
                        <Text className="text-primary font-bold text-base leading-5">•</Text>
                        <Text className="text-sm text-foreground/90 leading-5 flex-1">
                          {point}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* (c) Subtle sub-block: पुलिस नोट = `p` */}
                {Boolean(simpleExplain.p) && (
                  <View
                    className="p-3.5 rounded-xl bg-muted/40 border border-border/60 gap-1.5"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-xs font-bold text-primary uppercase tracking-wide">
                      {isHi ? 'पुलिस नोट' : 'Police Note'}
                    </Text>
                    <Text className="text-xs text-foreground/90 leading-5">
                      {simpleExplain.p}
                    </Text>
                  </View>
                )}

                {/* (d) Subtle sub-block: उदाहरण = `e` */}
                {Boolean(simpleExplain.e) && (
                  <View
                    className="p-3.5 rounded-xl bg-muted/40 border border-border/60 gap-1.5"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-xs font-bold text-foreground/80">
                      {isHi ? 'उदाहरण' : 'Example'}
                    </Text>
                    <Text className="text-xs text-muted-foreground leading-5">
                      {simpleExplain.e}
                    </Text>
                  </View>
                )}

                {/* Small muted disclaimer footer */}
                <View className="pt-2 border-t border-border/40">
                  <Text className="text-[11px] text-muted-foreground leading-4">
                    {isHi
                      ? 'यह सरल व्याख्या सहायता के लिए है, आधिकारिक पाठ नहीं। कार्रवाई/निर्णय से पहले नीचे का आधिकारिक पाठ देखें।'
                      : 'This simplified explanation is for guidance only, not the official text. Refer to the official text below before action or decision.'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Section Body (Formatted Book Page Layout) ── */}
        <View
          className="bg-card border border-border rounded-2xl shadow-sm shadow-black/5"
          style={{ padding: 12, borderCurve: 'continuous' }}
        >
          <SectionBody
            blocks={blocks}
            fontSize={fontSize}
            actColor={actColor}
            isHi={isHi}
          />

          <View className="mt-5 pt-3 border-t border-border/50 flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              Official Gazette of India (25-12-2023)
            </Text>
            <Text className="text-xs text-muted-foreground font-mono">
              {section.n} of {meta.total}
            </Text>
          </View>
        </View>

        {/* ── BNS Offence Classification Card (BNSS Schedule I) ── */}
        {classificationRows.length > 0 && (
          <View
            onLayout={(e) => {
              classificationCardYRef.current = e.nativeEvent.layout.y;
            }}
            className="p-5 bg-card border border-border rounded-2xl gap-3 shadow-sm shadow-black/5"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <Text className="text-sm font-bold text-foreground">
                  {t('knowledge.law.offenceClassification', 'अपराध वर्गीकरण (BNSS अनुसूची I)')}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground font-mono">
                {classificationRows.length} {isHi ? 'प्रविष्टि' : 'entry(ies)'}
              </Text>
            </View>

            {classificationRows.map((row, idx) => (
              <View
                key={`${row.sec}-${idx}`}
                className="p-4 rounded-xl bg-muted/40 border border-border/60 gap-2.5"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center justify-between">
                  <View
                    className="rounded-full bg-primary/10 px-2.5 py-1"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text textBreakStrategy="simple" className="text-xs font-bold text-primary">
                      BNS {row.sec}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    BNSS Sched. I
                  </Text>
                </View>

                {row.offence ? (
                  <Text className="text-sm font-semibold text-foreground leading-5">
                    {row.offence}
                  </Text>
                ) : null}

                {/* Structured details with icon rows */}
                <View className="gap-2 mt-1 pt-2 border-t border-border/40">
                  {/* Punishment */}
                  <View className="flex-row items-start gap-2">
                    <Text className="text-xs font-bold text-muted-foreground w-20">
                      {t('knowledge.law.punishment', 'दंड')}:
                    </Text>
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {row.punishment || '—'}
                    </Text>
                  </View>

                  {/* Cognizable */}
                  <View className="flex-row items-start gap-2">
                    <Text className="text-xs font-bold text-muted-foreground w-20">
                      {t('knowledge.law.cognizable', 'संज्ञेय')}:
                    </Text>
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {row.cognizable || '—'}
                    </Text>
                  </View>

                  {/* Bailable */}
                  <View className="flex-row items-start gap-2">
                    <Text className="text-xs font-bold text-muted-foreground w-20">
                      {t('knowledge.law.bailable', 'जमानती')}:
                    </Text>
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {row.bailable || '—'}
                    </Text>
                  </View>

                  {/* Triable by */}
                  <View className="flex-row items-start gap-2">
                    <Text className="text-xs font-bold text-muted-foreground w-20">
                      {t('knowledge.law.triableBy', 'न्यायालय')}:
                    </Text>
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {row.court || '—'}
                    </Text>
                  </View>

                  {/* If row has variants, show each variant neatly */}
                  {Array.isArray(row.variants) && row.variants.length > 0 && (
                    <View className="mt-2 pt-2 border-t border-border/30 gap-2">
                      <Text className="text-xs font-bold text-primary">
                        {t('knowledge.law.variants', 'उप-प्रकार / Variants')}:
                      </Text>
                      {row.variants.map((v, vIdx) => (
                        <View
                          key={vIdx}
                          className="p-2.5 rounded-lg bg-background border border-border/50 gap-1"
                          style={{ borderCurve: 'continuous' }}
                        >
                          {v.punishment ? (
                            <Text className="text-xs font-medium text-foreground">
                              <Text className="text-muted-foreground font-bold">{t('knowledge.law.punishment', 'दंड')}: </Text>
                              {v.punishment}
                            </Text>
                          ) : null}
                          <Text className="text-xs text-muted-foreground">
                            {v.cognizable} · {v.bailable} · {v.court}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Detailed Analysis Card ("विस्तृत विश्लेषण") ── */}
        {detailedExplain ? (
          <DetailedAnalysisCard entry={detailedExplain} isHi={isHi} />
        ) : null}

        {/* ── Verified Case Law Card ("महत्वपूर्ण निर्णय") ── */}
        {cases.length > 0 ? (
          <CaseLawCard cases={cases} isHi={isHi} />
        ) : null}

        {/* ── A2: 'संबंधित धाराएँ' Related Sections Card (BELOW section text / classification card) ── */}
        {linkCounts.total > 0 && (
          <View
            onLayout={(e) => {
              relatedCardYRef.current = e.nativeEvent.layout.y;
            }}
            className="p-5 bg-card border border-border rounded-2xl gap-4 shadow-sm shadow-black/5"
            style={{ borderCurve: 'continuous' }}
          >
            {/* Card Header */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Link2 size={16} color={C.primary} />
                <Text className="text-sm font-bold text-foreground">
                  {isHi ? 'संबंधित धाराएँ' : 'Related sections'}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground font-mono">
                {linkCounts.total} {isHi ? 'लिंक' : 'link(s)'}
              </Text>
            </View>

            {/* Group 1: Mentioned in this section (refs) */}
            {links.refs.length > 0 && (
              <View className="gap-2.5">
                <Text className="text-xs font-bold text-foreground/80 tracking-wide">
                  {isHi ? 'इस धारा के पाठ में उल्लिखित' : 'Mentioned in this section'} ({links.refs.length})
                </Text>
                {(() => {
                  const visibleRefs = showAllRefs ? links.refs : links.refs.slice(0, 12);
                  const actGroupOrder: ActId[] = ['BNS', 'BNSS', 'BSA'];
                  return (
                    <View className="gap-3">
                      {actGroupOrder.map((groupAct) => {
                        const items = visibleRefs.filter((r) => r.act === groupAct);
                        if (items.length === 0) return null;
                        const gColor = groupAct === 'BNS' ? '#1D4ED8' : groupAct === 'BNSS' ? '#0F766E' : '#B45309';
                        return (
                          <View key={groupAct} className="gap-2">
                            <View className="flex-row items-center gap-1.5">
                              <View
                                className="rounded-full px-2.5 py-1"
                                style={{ backgroundColor: `${gColor}15`, borderCurve: 'continuous' }}
                              >
                                <Text textBreakStrategy="simple" className="text-[10px] font-bold" style={{ color: gColor }}>
                                  {groupAct}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                              {items.map((item) => (
                                <Pressable
                                  key={`${item.act}:${item.n}`}
                                  onPress={() => openSection(router, item.act, item.n)}
                                  className="px-3 py-2 rounded-xl border border-border bg-background active:opacity-70 gap-0.5"
                                  style={{ borderCurve: 'continuous', minHeight: 44, maxWidth: '100%' }}
                                >
                                  <View className="flex-row items-center gap-1">
                                    <Text className="text-xs font-bold text-foreground">
                                      {isHi ? `धारा ${item.n}` : `Sec ${item.n}`}
                                    </Text>
                                    {item.act !== actId && (
                                      <Text className="text-[11px] font-bold text-primary">↗</Text>
                                    )}
                                  </View>
                                  <Text className="text-[11px] text-muted-foreground leading-4" numberOfLines={2}>
                                    {item.title}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                      {links.refs.length > 12 && (
                        <Pressable
                          onPress={() => setShowAllRefs((prev) => !prev)}
                          className="py-1.5 items-center active:opacity-70"
                        >
                          <Text className="text-xs font-semibold text-primary">
                            {showAllRefs
                              ? (isHi ? 'कम देखें' : 'Show less')
                              : (isHi ? `और देखें (${links.refs.length - 12})` : `Show more (${links.refs.length - 12})`)}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Group 2: Cited by (citedBy) */}
            {links.citedBy.length > 0 && (
              <View className="gap-2.5 pt-2 border-t border-border/40">
                <Text className="text-xs font-bold text-foreground/80 tracking-wide">
                  {isHi ? 'जिन धाराओं में इसका उल्लेख है' : 'Cited by'} ({links.citedBy.length})
                </Text>
                {(() => {
                  const visibleCited = showAllCitedBy ? links.citedBy : links.citedBy.slice(0, 12);
                  const actGroupOrder: ActId[] = ['BNS', 'BNSS', 'BSA'];
                  return (
                    <View className="gap-3">
                      {actGroupOrder.map((groupAct) => {
                        const items = visibleCited.filter((c) => c.act === groupAct);
                        if (items.length === 0) return null;
                        const gColor = groupAct === 'BNS' ? '#1D4ED8' : groupAct === 'BNSS' ? '#0F766E' : '#B45309';
                        return (
                          <View key={groupAct} className="gap-2">
                            <View className="flex-row items-center gap-1.5">
                              <View
                                className="rounded-full px-2.5 py-1"
                                style={{ backgroundColor: `${gColor}15`, borderCurve: 'continuous' }}
                              >
                                <Text textBreakStrategy="simple" className="text-[10px] font-bold" style={{ color: gColor }}>
                                  {groupAct}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                              {items.map((item) => (
                                <Pressable
                                  key={`${item.act}:${item.n}`}
                                  onPress={() => openSection(router, item.act, item.n)}
                                  className="px-3 py-2 rounded-xl border border-border bg-background active:opacity-70 gap-0.5"
                                  style={{ borderCurve: 'continuous', minHeight: 44, maxWidth: '100%' }}
                                >
                                  <View className="flex-row items-center gap-1">
                                    <Text className="text-xs font-bold text-foreground">
                                      {isHi ? `धारा ${item.n}` : `Sec ${item.n}`}
                                    </Text>
                                    {item.act !== actId && (
                                      <Text className="text-[11px] font-bold text-primary">↗</Text>
                                    )}
                                  </View>
                                  <Text className="text-[11px] text-muted-foreground leading-4" numberOfLines={2}>
                                    {item.title}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                      {links.citedBy.length > 12 && (
                        <Pressable
                          onPress={() => setShowAllCitedBy((prev) => !prev)}
                          className="py-1.5 items-center active:opacity-70"
                        >
                          <Text className="text-xs font-semibold text-primary">
                            {showAllCitedBy
                              ? (isHi ? 'कम देखें' : 'Show less')
                              : (isHi ? `और देखें (${links.citedBy.length - 12})` : `Show more (${links.citedBy.length - 12})`)}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Small muted footer */}
            <View className="pt-2 border-t border-border/40">
              <Text className="text-[11px] text-muted-foreground leading-4">
                {isHi
                  ? 'ये लिंक अधिनियम के पाठ में आए धारा-उल्लेखों से स्वतः बने हैं; सभी संबंध इनमें नहीं होते।'
                  : 'Links are generated from section mentions in the official text; not every relationship is included.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Persistent Bottom Navigation Bar (Solid Opaque Footer Below ScrollView) ── */}
      <View
        style={{
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingTop: 10,
          paddingBottom: 8,
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 4,
          elevation: 5,
        }}
        className="flex-row items-center justify-between"
      >
        <Pressable
          onPress={handlePrev}
          disabled={sectionNum <= 1}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background active:opacity-70 disabled:opacity-40"
          style={{ borderCurve: 'continuous', minHeight: 44, minWidth: 44 }}
          accessibilityLabel="Previous Section"
        >
          <ChevronLeft size={18} color={sectionNum <= 1 ? C.mutedForeground : C.foreground} />
          <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
            {isHi ? 'पिछली' : 'Previous'}
          </Text>
        </Pressable>

        {/* Centre shows '2 / 358' and act code on two lines */}
        <View className="items-center justify-center px-2">
          <Text className="text-sm font-bold text-foreground font-mono" numberOfLines={1}>
            {sectionNum} / {meta.total}
          </Text>
          <Text className="text-[11px] font-bold tracking-wider" style={{ color: actColor }} numberOfLines={1}>
            {actId}
          </Text>
        </View>

        <Pressable
          onPress={handleNext}
          disabled={sectionNum >= meta.total}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background active:opacity-70 disabled:opacity-40"
          style={{ borderCurve: 'continuous', minHeight: 44, minWidth: 44 }}
          accessibilityLabel="Next Section"
        >
          <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
            {isHi ? 'अगली' : 'Next'}
          </Text>
          <ChevronRight size={18} color={sectionNum >= meta.total ? C.mutedForeground : C.foreground} />
        </Pressable>
      </View>

      {/* ── Old Law <-> New Law Bottom Sheet Modal ── */}
      <Modal
        visible={oldLawModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setOldLawModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable
            className="flex-1"
            onPress={() => setOldLawModalOpen(false)}
            accessibilityLabel="Close modal overlay"
          />
          <View
            className="bg-card border-t border-border rounded-t-3xl p-5 gap-4 max-h-[82%]"
            style={{ borderCurve: 'continuous', paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {/* Sheet Handle */}
            <View className="items-center">
              <View className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </View>

            {/* Header */}
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-[15px] font-bold text-foreground leading-[21px]">
                  {oldLawRef.isNewProvision
                    ? `यह धारा (${actId} ${section.n}) नया प्रावधान है`
                    : `यह धारा पुरानी ${oldLawRef.oldAct} ${activeOldSec || oldLawRef.oldSections[0]} से संबंधित है`}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {oldLawRef.isNewProvision
                    ? 'पुराने कानूनों में इसका कोई सीधा पूर्ववर्ती प्रावधान नहीं था।'
                    : 'तुलना तालिका (आधिकारिक तुलना-तालिका) के अनुसार:'}
                </Text>
              </View>
              <Pressable
                onPress={() => setOldLawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-70"
                accessibilityLabel="Close"
              >
                <X size={16} color={C.mutedForeground} />
              </Pressable>
            </View>

            {/* Multi old sections selector tabs (e.g. IPC 415, 417, 418, 420) */}
            {!oldLawRef.isNewProvision && oldLawRef.oldSections.length > 1 && (
              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground">
                  अन्य संबंधित पुरानी धाराएँ चुनें:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-1">
                  {oldLawRef.oldSections.map((secStr) => {
                    const isSelected = (activeOldSec || oldLawRef.oldSections[0]) === secStr;
                    return (
                      <Pressable
                        key={secStr}
                        onPress={() => setActiveOldSec(secStr)}
                        className={`px-3 py-1.5 rounded-full border ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500'
                            : 'bg-muted/60 border-border'
                        }`}
                        style={{ borderCurve: 'continuous' }}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isSelected
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-foreground'
                          }`}
                        >
                          {oldLawRef.oldAct} {secStr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Related New Sections list */}
            {!oldLawRef.isNewProvision && (
              <View className="gap-2 flex-1">
                <Text className="text-xs font-bold text-foreground">
                  {`पुरानी ${oldLawRef.oldAct} ${activeOldSec || oldLawRef.oldSections[0]} से जुड़ी नई धारा(एँ):`}
                </Text>
                <ScrollView className="max-h-64" showsVerticalScrollIndicator={false}>
                  <View className="gap-2.5 pb-2">
                    {(() => {
                      const curOld = activeOldSec || oldLawRef.oldSections[0];
                      const targets = getNewSectionsForOld(oldLawRef.oldAct, curOld);
                      if (targets.length === 0) {
                        return (
                          <Text className="text-xs text-muted-foreground py-2">
                            कोई अन्य धारा दर्ज नहीं है।
                          </Text>
                        );
                      }
                      return targets.map((t) => {
                        const targetSec = getSection(t.act, t.n);
                        const isCurrent = t.act === actId && t.n === section.n;
                        const tColor = t.act === 'BNS' ? '#1D4ED8' : t.act === 'BNSS' ? '#0F766E' : '#B45309';
                        return (
                          <Pressable
                            key={`${t.act}:${t.n}`}
                            onPress={() => {
                              setOldLawModalOpen(false);
                              if (!isCurrent) {
                                openSection(router, t.act, t.n);
                              }
                            }}
                            className={`p-3.5 rounded-2xl border ${
                              isCurrent
                                ? 'bg-primary/5 border-primary/40'
                                : 'bg-background border-border active:opacity-70'
                            }`}
                            style={{ borderCurve: 'continuous' }}
                          >
                            <View className="flex-row items-center justify-between mb-1">
                              <View className="flex-row items-center gap-2">
                                <View
                                  className="px-2 py-0.5 rounded-md"
                                  style={{ backgroundColor: `${tColor}15` }}
                                >
                                  <Text className="text-xs font-extrabold" style={{ color: tColor }}>
                                    {t.act} {t.n}
                                  </Text>
                                </View>
                                {isCurrent && (
                                  <View className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1">
                                    <Text textBreakStrategy="simple" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                      वर्तमान धारा
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {!isCurrent && (
                                <Text className="text-xs font-bold text-primary">
                                  खोलें ↗
                                </Text>
                              )}
                            </View>
                            <Text className="text-sm font-semibold text-foreground leading-5" numberOfLines={2}>
                              {targetSec?.title || `Section ${t.n}`}
                            </Text>
                          </Pressable>
                        );
                      });
                    })()}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Required Footer Note */}
            <View className="pt-3 border-t border-border/50">
              <Text className="text-[11px] text-muted-foreground text-center leading-4">
                सहायक सूचना — मिलान आधिकारिक तुलना-तालिकाओं से; वास्तविक पाठ अवश्य देखें।
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
