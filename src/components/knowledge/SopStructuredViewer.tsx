import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ChevronDown, ChevronRight, AlertCircle, ArrowDown, CheckSquare, Square, ShieldAlert } from 'lucide-react-native';
import { SopStruct, SopBlock, SopFig } from '../../ai/sopStruct';
import { SopImage } from './SopImage';

interface SopStructuredViewerProps {
  sop: SopStruct;
  searchQuery?: string;
  onLawPress?: (oldLaw: string, newLaws: string[]) => void;
  onCircularPress?: (circ: { n: string; id: string | null }) => void;
}

// ── Text Highlight Helper ──────────────────────────────────────────────────
export function HighlightText({
  text,
  query,
  className = '',
  highlightClassName = 'bg-amber-300 dark:bg-amber-700/80 text-amber-950 dark:text-amber-100 font-bold px-0.5 rounded',
}: {
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
}) {
  if (!text) return null;
  const q = query?.trim().toLowerCase();
  if (!q) {
    return <Text className={className}>{text}</Text>;
  }

  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(q, start);

  while (idx !== -1) {
    if (idx > start) {
      parts.push(
        <Text key={`pre-${start}`} className={className}>
          {text.slice(start, idx)}
        </Text>
      );
    }
    parts.push(
      <Text key={`match-${idx}`} className={highlightClassName}>
        {text.slice(idx, idx + q.length)}
      </Text>
    );
    start = idx + q.length;
    idx = lower.indexOf(q, start);
  }

  if (start < text.length) {
    parts.push(
      <Text key={`post-${start}`} className={className}>
        {text.slice(start)}
      </Text>
    );
  }

  return <Text className={className}>{parts}</Text>;
}

// Check if a block matches search query
function blockMatchesQuery(block: SopBlock, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  const checkVal = (v: any): boolean => {
    if (!v) return false;
    if (typeof v === 'string') return v.toLowerCase().includes(q);
    if (typeof v === 'number') return String(v).includes(q);
    if (Array.isArray(v)) return v.some(checkVal);
    if (typeof v === 'object') return Object.values(v).some(checkVal);
    return false;
  };

  return checkVal(block);
}

export function SopStructuredViewer({
  sop,
  searchQuery = '',
  onLawPress,
  onCircularPress,
}: SopStructuredViewerProps) {
  const cleanQuery = searchQuery.trim().toLowerCase();

  // Filter blocks if search query is provided
  const visibleBlocks = useMemo(() => {
    if (!cleanQuery) return sop.blocks;
    return sop.blocks.filter((b) => blockMatchesQuery(b, cleanQuery));
  }, [sop.blocks, cleanQuery]);

  return (
    <View className="gap-3">
      {cleanQuery && visibleBlocks.length === 0 ? (
        <View className="p-6 rounded-2xl bg-card border border-border items-center justify-center my-4">
          <AlertCircle size={28} className="text-muted-foreground opacity-60 mb-2" />
          <Text className="text-sm font-semibold text-foreground">
            &quot;{searchQuery}&quot; के लिए कोई मिलान नहीं मिला
          </Text>
          <Text className="text-xs text-muted-foreground mt-1 text-center">
            कृपया अन्य शब्द खोजें या फ़िल्टर साफ़ करें
          </Text>
        </View>
      ) : null}

      {visibleBlocks.map((block, idx) => (
        <BlockRenderer
          key={`${block.k}-${idx}`}
          block={block}
          query={cleanQuery}
          src={sop.src}
          blockIndex={idx}
          onLawPress={onLawPress}
        />
      ))}
    </View>
  );
}

// ── Generic Block Dispatcher ───────────────────────────────────────────────
function BlockRenderer({
  block,
  query,
  src,
  blockIndex,
  onLawPress,
}: {
  block: SopBlock;
  query: string;
  src: 'b1' | 'b2' | 'b3';
  blockIndex: number;
  onLawPress?: (oldLaw: string, newLaws: string[]) => void;
}) {
  const { k } = block;

  switch (k) {
    case 'text':
      return <TextBlock block={block} query={query} />;

    case 'steps':
      return src === 'b3' ? (
        <StepsB3Block block={block} query={query} />
      ) : (
        <StepsB1B2Block block={block} query={query} />
      );

    case 'form':
      return <FormBlock block={block} query={query} src={src} />;

    case 'intro':
      return <IntroBlock block={block} query={query} />;

    case 'cards':
      return <CardsBlock block={block} query={query} />;

    case 'points':
      return <PointsBlock block={block} query={query} />;

    case 'dd':
      return <DoDontTableBlock block={block} query={query} />;

    case 'dd2':
      return <DoDont2Block block={block} query={query} />;

    case 'crimetypes':
      return <CrimeTypesBlock block={block} query={query} />;

    case 'evtype':
      return <EvTypeBlock block={block} query={query} />;

    case 'table':
      return <TableBlock block={block} query={query} />;

    case 'note':
      return <NoteBlock block={block} query={query} />;

    case 'law':
      return <LawBlock block={block} query={query} onLawPress={onLawPress} />;

    case 'devices':
      return <DevicesBlock block={block} query={query} />;

    case 'two':
      return <TwoBlock block={block} query={query} />;

    case 'flow':
      return <FlowBlock block={block} query={query} />;

    case 'terms':
      return <TermsBlock block={block} query={query} />;

    default:
      // Unknown k -> render any strings found as bullets, never crash
      return <FallbackBlock block={block} query={query} />;
  }
}

// ── Block: text ────────────────────────────────────────────────────────────
function TextBlock({ block, query }: { block: SopBlock; query: string }) {
  return (
    <View className="bg-card border border-border/80 rounded-2xl p-4 gap-1.5 shadow-sm shadow-black/5">
      {block.label ? (
        <HighlightText
          text={block.label}
          query={query}
          className="text-xs font-bold text-primary uppercase tracking-wider"
        />
      ) : null}
      {block.t ? (
        <HighlightText
          text={block.t}
          query={query}
          className="text-sm font-medium text-foreground leading-6"
        />
      ) : null}
    </View>
  );
}

// ── Block: steps (src b1/b2) ──────────────────────────────────────────────
function StepsB1B2Block({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.title ? (
        <View className="border-b border-border/60 pb-2">
          <HighlightText
            text={block.title}
            query={query}
            className="text-base font-bold text-foreground"
          />
        </View>
      ) : null}

      <View className="gap-2.5">
        {items.map((item, idx) => {
          const isMust = item.must === 1;
          const isDont = item.dont === 1;
          const subItems = Array.isArray(item.sub) ? item.sub : [];

          return (
            <View
              key={`st-${idx}`}
              className={`p-3 rounded-xl border ${
                isDont
                  ? 'bg-destructive/10 border-destructive/30'
                  : isMust
                  ? 'bg-primary/5 border-primary/25'
                  : 'bg-muted/20 border-border/60'
              }`}
            >
              <View className="flex-row items-start gap-2">
                <Text
                  className={`text-sm font-bold mt-0.5 ${
                    isDont
                      ? 'text-destructive'
                      : isMust
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {isDont ? '✗' : `${idx + 1}.`}
                </Text>
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    {isMust ? (
                      <View className="bg-emerald-600/15 border border-emerald-600/30 px-2 py-0.5 rounded-full">
                        <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          ✱ ज़रूरी
                        </Text>
                      </View>
                    ) : null}
                    {isDont ? (
                      <View className="bg-destructive/20 border border-destructive/40 px-2 py-0.5 rounded-full">
                        <Text className="text-[11px] font-bold text-destructive">
                          ✗ न करें / सावधानी
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <HighlightText
                    text={item.t}
                    query={query}
                    className={`text-sm leading-6 ${
                      isDont
                        ? 'text-destructive font-medium'
                        : 'text-foreground'
                    }`}
                  />

                  {/* Sub items */}
                  {subItems.length > 0 ? (
                    <View className="mt-2 pl-3 border-l-2 border-border/80 gap-1.5">
                      {subItems.map((sub: any, sIdx: number) => {
                        const subMust = sub.must === 1;
                        const subDont = sub.dont === 1;
                        return (
                          <View
                            key={`sub-${sIdx}`}
                            className="flex-row items-start gap-2"
                          >
                            <Text className="text-xs text-muted-foreground mt-1">
                              •
                            </Text>
                            <View className="flex-1">
                              {subMust ? (
                                <Text className="text-[10px] font-bold text-emerald-700">
                                  ✱{' '}
                                </Text>
                              ) : null}
                              {subDont ? (
                                <Text className="text-[10px] font-bold text-destructive">
                                  ✗{' '}
                                </Text>
                              ) : null}
                              <HighlightText
                                text={sub.t}
                                query={query}
                                className="text-xs text-muted-foreground leading-5"
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Block: steps (b3 numbered accordions) ───────────────────────────────────
function StepsB3Block({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const toggle = (idx: number) => {
    setOpenMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      <View className="gap-2.5">
        {items.map((item, idx) => {
          const isOpen = openMap[idx] || (query && blockMatchesQuery(item, query));
          const figs: SopFig[] = Array.isArray(item.figs) ? item.figs : [];

          return (
            <View
              key={`st3-${idx}`}
              className="border border-border rounded-xl overflow-hidden bg-muted/15"
            >
              <Pressable
                onPress={() => toggle(idx)}
                className="flex-row items-center justify-between p-3.5 bg-card active:opacity-70"
              >
                <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                  <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center">
                    <Text className="text-xs font-bold text-primary">{idx + 1}</Text>
                  </View>
                  <HighlightText
                    text={item.t}
                    query={query}
                    className="text-sm font-semibold text-foreground flex-1"
                  />
                </View>
                {isOpen ? (
                  <ChevronDown size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={18} className="text-muted-foreground" />
                )}
              </Pressable>

              {isOpen ? (
                <View className="p-3.5 pt-1 border-t border-border/40 gap-2">
                  {item.d ? (
                    <HighlightText
                      text={item.d}
                      query={query}
                      className="text-sm text-foreground/90 leading-6"
                    />
                  ) : null}

                  {figs.map((f, fIdx) => (
                    <SopImage key={`fig-${fIdx}`} id={f.id} cap={f.cap} sens={f.sens} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Block: form (b2 or b3) ────────────────────────────────────────────────
function FormBlock({
  block,
  query,
  src,
}: {
  block: SopBlock;
  query: string;
  src: 'b1' | 'b2' | 'b3';
}) {
  const fields = Array.isArray(block.fields) ? block.fields : [];
  const figs = Array.isArray(block.figs) ? block.figs : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      {block.note ? (
        <View className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex-row gap-2">
          <AlertCircle size={16} className="text-amber-600 mt-0.5" />
          <HighlightText
            text={block.note}
            query={query}
            className="text-xs text-amber-900 dark:text-amber-200 leading-5 flex-1"
          />
        </View>
      ) : null}

      <View className="gap-2">
        {fields.map((f: any, idx: number) => {
          // b2 shape: { h: string } or { f: string }
          if (typeof f === 'object' && f !== null) {
            if (f.h) {
              return (
                <View
                  key={`fh-${idx}`}
                  className="mt-2 pt-2 border-t border-border/60"
                >
                  <HighlightText
                    text={f.h}
                    query={query}
                    className="text-xs font-bold text-primary uppercase tracking-wider"
                  />
                </View>
              );
            }
            if (f.f) {
              return (
                <View
                  key={`ff-${idx}`}
                  className="flex-row items-start gap-2.5 py-1 px-2 rounded-lg bg-muted/20"
                >
                  <Square size={14} className="text-muted-foreground mt-1" />
                  <HighlightText
                    text={f.f}
                    query={query}
                    className="text-sm text-foreground flex-1 leading-5"
                  />
                </View>
              );
            }
          }

          // b3 shape: string field
          return (
            <View
              key={`strf-${idx}`}
              className="flex-row items-start gap-2.5 py-1.5 px-2 rounded-lg bg-muted/20"
            >
              <CheckSquare size={14} className="text-primary mt-1" />
              <HighlightText
                text={String(f)}
                query={query}
                className="text-sm text-foreground flex-1 leading-5"
              />
            </View>
          );
        })}
      </View>

      {figs.map((fig, fIdx) => (
        <SopImage key={`form-fig-${fIdx}`} id={fig.id} cap={fig.cap} sens={fig.sens} />
      ))}
    </View>
  );
}

// ── Block: intro ───────────────────────────────────────────────────────────
function IntroBlock({ block, query }: { block: SopBlock; query: string }) {
  const figs = Array.isArray(block.figs) ? block.figs : [];
  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-2 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}
      {block.t ? (
        <HighlightText
          text={block.t}
          query={query}
          className="text-sm font-medium text-foreground leading-6"
        />
      ) : null}
      {figs.map((f, i) => (
        <SopImage key={`intro-fig-${i}`} id={f.id} cap={f.cap} sens={f.sens} />
      ))}
    </View>
  );
}

// ── Block: cards ───────────────────────────────────────────────────────────
function CardsBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];
  return (
    <View className="gap-3">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}
      <View className="gap-2.5">
        {items.map((it, idx) => (
          <View
            key={`cd-${idx}`}
            className="bg-card border border-border rounded-2xl p-4 gap-1.5 shadow-sm shadow-black/5"
          >
            <HighlightText
              text={it.t}
              query={query}
              className="text-sm font-bold text-foreground"
            />
            {it.d ? (
              <HighlightText
                text={it.d}
                query={query}
                className="text-sm text-muted-foreground leading-5"
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Block: points ──────────────────────────────────────────────────────────
function PointsBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];
  const figs = Array.isArray(block.figs) ? block.figs : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-2.5 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}
      <View className="gap-2">
        {items.map((pt, idx) => (
          <View key={`pt-${idx}`} className="flex-row items-start gap-2">
            <Text className="text-primary font-bold text-sm mt-0.5">•</Text>
            <HighlightText
              text={String(pt)}
              query={query}
              className="text-sm text-foreground flex-1 leading-5"
            />
          </View>
        ))}
      </View>
      {figs.map((f, i) => (
        <SopImage key={`pt-fig-${i}`} id={f.id} cap={f.cap} sens={f.sens} />
      ))}
    </View>
  );
}

// ── Block: dd (2-column table: करें ✓ | न करें ✗) ──────────────────────────
function DoDontTableBlock({ block, query }: { block: SopBlock; query: string }) {
  const rows: Array<[string, string]> = Array.isArray(block.rows) ? block.rows : [];
  const rowimgs = Array.isArray(block.rowimgs) ? block.rowimgs : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5 overflow-hidden">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      {/* 2-Column Header */}
      <View className="flex-row gap-2">
        <View className="flex-1 bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-xl items-center">
          <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            करें ✓ (Do)
          </Text>
        </View>
        <View className="flex-1 bg-destructive/15 border border-destructive/30 p-2.5 rounded-xl items-center">
          <Text className="text-xs font-bold text-destructive">
            न करें ✗ (Don&apos;t)
          </Text>
        </View>
      </View>

      {/* Rows */}
      <View className="gap-2.5">
        {rows.map((row, idx) => {
          const doText = row[0] || '';
          const dontText = row[1] || '';
          const rImg = rowimgs[idx] || {};
          const doImgs: string[] = Array.isArray(rImg.do) ? rImg.do : [];
          const dontImgs: string[] = Array.isArray(rImg.dont) ? rImg.dont : [];

          return (
            <View key={`dd-r-${idx}`} className="flex-row gap-2 border-b border-border/40 pb-2.5">
              {/* Do Cell */}
              <View className="flex-1 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 gap-1.5">
                <HighlightText
                  text={doText}
                  query={query}
                  className="text-xs font-medium text-emerald-950 dark:text-emerald-100 leading-5"
                />
                {doImgs.map((imgId) => (
                  <SopImage key={`do-img-${imgId}`} id={imgId} />
                ))}
              </View>

              {/* Don't Cell */}
              <View className="flex-1 p-2 rounded-xl bg-destructive/5 border border-destructive/20 gap-1.5">
                <HighlightText
                  text={dontText}
                  query={query}
                  className="text-xs font-medium text-destructive leading-5"
                />
                {dontImgs.map((imgId) => (
                  <SopImage key={`dont-img-${imgId}`} id={imgId} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Block: dd2 (Two lists: green do / red dont) ───────────────────────────
function DoDont2Block({ block, query }: { block: SopBlock; query: string }) {
  const doList = Array.isArray(block.do) ? block.do : [];
  const dontList = Array.isArray(block.dont) ? block.dont : [];

  return (
    <View className="gap-3">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}

      {/* Do List */}
      {doList.length > 0 ? (
        <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 gap-2">
          <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            करें ✓ (Recommended Actions)
          </Text>
          <View className="gap-2">
            {doList.map((item, idx) => (
              <View key={`do-${idx}`} className="flex-row items-start gap-2">
                <Text className="text-xs font-bold text-emerald-600 mt-0.5">✓</Text>
                <HighlightText
                  text={String(item)}
                  query={query}
                  className="text-sm font-medium text-emerald-950 dark:text-emerald-100 flex-1 leading-5"
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Don't List */}
      {dontList.length > 0 ? (
        <View className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 gap-2">
          <Text className="text-xs font-bold text-destructive uppercase tracking-wider">
            न करें ✗ (Prohibited / Avoid)
          </Text>
          <View className="gap-2">
            {dontList.map((item, idx) => (
              <View key={`dont-${idx}`} className="flex-row items-start gap-2">
                <Text className="text-xs font-bold text-destructive mt-0.5">✗</Text>
                <HighlightText
                  text={String(item)}
                  query={query}
                  className="text-sm font-medium text-destructive flex-1 leading-5"
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Block: crimetypes (Collapsible accordions, first open) ─────────────────
function CrimeTypesBlock({ block, query }: { block: SopBlock; query: string }) {
  const sections = Array.isArray(block.sections) ? block.sections : [];
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({ 0: true });

  const toggle = (idx: number) => {
    setOpenMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <View className="gap-2.5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}

      {sections.map((sec: any, idx: number) => {
        const isOpen = openMap[idx] || (query && blockMatchesQuery(sec, query));
        const items = Array.isArray(sec.items) ? sec.items : [];
        const imgs = Array.isArray(sec.imgs) ? sec.imgs : [];

        return (
          <View
            key={`sec-${idx}`}
            className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm shadow-black/5"
          >
            <Pressable
              onPress={() => toggle(idx)}
              className="flex-row items-center justify-between p-4 active:opacity-70 bg-card"
            >
              <HighlightText
                text={sec.t}
                query={query}
                className="text-sm font-bold text-foreground flex-1 pr-2"
              />
              {isOpen ? (
                <ChevronDown size={18} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={18} className="text-muted-foreground" />
              )}
            </Pressable>

            {isOpen ? (
              <View className="p-4 pt-1 border-t border-border/50 gap-2.5 bg-muted/10">
                <View className="gap-2">
                  {items.map((it: any, itIdx: number) => (
                    <View key={`sec-it-${itIdx}`} className="flex-row items-start gap-2">
                      <Text className="text-primary font-bold text-xs mt-1">•</Text>
                      <HighlightText
                        text={String(it)}
                        query={query}
                        className="text-sm text-foreground flex-1 leading-5"
                      />
                    </View>
                  ))}
                </View>

                {imgs.map((img: any, iIdx: number) => (
                  <SopImage
                    key={`sec-img-${iIdx}`}
                    id={img.id}
                    cap={img.cap}
                    sens={img.sens}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Block: evtype (Cards with साक्ष्य / अपराध / पैकिंग) ──────────────────────
function EvTypeBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];

  return (
    <View className="gap-3">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}

      <View className="gap-3">
        {items.map((it: any, idx: number) => {
          const pkList = Array.isArray(it.pk) ? it.pk : [];
          const figs = Array.isArray(it.figs) ? it.figs : [];

          return (
            <View
              key={`ev-${idx}`}
              className="bg-card border border-border rounded-2xl p-4 gap-2.5 shadow-sm shadow-black/5"
            >
              <HighlightText
                text={it.t}
                query={query}
                className="text-base font-bold text-foreground"
              />

              {it.ev ? (
                <View className="gap-0.5">
                  <Text className="text-[11px] font-bold text-primary uppercase">
                    साक्ष्य (Evidence):
                  </Text>
                  <HighlightText
                    text={it.ev}
                    query={query}
                    className="text-sm text-foreground/90 leading-5"
                  />
                </View>
              ) : null}

              {it.cr ? (
                <View className="gap-0.5">
                  <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                    अपराध (Crime Type):
                  </Text>
                  <HighlightText
                    text={it.cr}
                    query={query}
                    className="text-sm text-foreground/90 leading-5"
                  />
                </View>
              ) : null}

              {pkList.length > 0 ? (
                <View className="gap-1 mt-1 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                  <Text className="text-[11px] font-bold text-muted-foreground uppercase">
                    पैकिंग / संरक्षण विधि (Packing):
                  </Text>
                  {pkList.map((pk: string, pkIdx: number) => (
                    <View key={`pk-${pkIdx}`} className="flex-row items-start gap-1.5 pl-1">
                      <Text className="text-xs text-muted-foreground mt-0.5">•</Text>
                      <HighlightText
                        text={pk}
                        query={query}
                        className="text-xs text-foreground flex-1 leading-4"
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              {figs.map((f: any, fIdx: number) => (
                <SopImage key={`ev-fig-${fIdx}`} id={f.id} cap={f.cap} sens={f.sens} />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Block: table (Horizontally scrollable, sticky first column style) ───────
function TableBlock({ block, query }: { block: SopBlock; query: string }) {
  const tables = Array.isArray(block.tables) ? block.tables : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5 overflow-hidden">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      {block.note ? (
        <View className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex-row gap-2">
          <AlertCircle size={16} className="text-amber-600 mt-0.5" />
          <HighlightText
            text={block.note}
            query={query}
            className="text-xs text-amber-900 dark:text-amber-200 leading-5 flex-1"
          />
        </View>
      ) : null}

      {tables.map((tbl: any, tIdx: number) => {
        const cols: string[] = Array.isArray(tbl.cols) ? tbl.cols : [];
        const rows: string[][] = Array.isArray(tbl.rows) ? tbl.rows : [];

        return (
          <View key={`tb-${tIdx}`} className="gap-2">
            {tbl.t ? (
              <HighlightText
                text={tbl.t}
                query={query}
                className="text-sm font-bold text-foreground"
              />
            ) : null}

            {/* Horizontal scroll for table only per specification */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              className="border border-border rounded-xl"
            >
              <View>
                {/* Header Row */}
                <View className="flex-row bg-muted/60 border-b border-border">
                  {cols.map((col, cIdx) => (
                    <View
                      key={`th-${cIdx}`}
                      style={{ width: cIdx === 0 ? 140 : 180 }}
                      className={`p-2.5 ${cIdx === 0 ? 'bg-muted/90 border-r border-border' : 'border-r border-border/40'}`}
                    >
                      <HighlightText
                        text={col}
                        query={query}
                        className="text-xs font-bold text-foreground"
                      />
                    </View>
                  ))}
                </View>

                {/* Data Rows */}
                {rows.map((row, rIdx) => (
                  <View
                    key={`tr-${rIdx}`}
                    className={`flex-row border-b border-border/30 ${
                      rIdx % 2 === 1 ? 'bg-muted/15' : 'bg-card'
                    }`}
                  >
                    {row.map((cell, cIdx) => (
                      <View
                        key={`td-${cIdx}`}
                        style={{ width: cIdx === 0 ? 140 : 180 }}
                        className={`p-2.5 ${
                          cIdx === 0
                            ? 'bg-muted/40 font-semibold border-r border-border'
                            : 'border-r border-border/30'
                        }`}
                      >
                        <HighlightText
                          text={String(cell)}
                          query={query}
                          className="text-xs text-foreground leading-4"
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

// ── Block: note ────────────────────────────────────────────────────────────
function NoteBlock({ block, query }: { block: SopBlock; query: string }) {
  return (
    <View className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 gap-2 flex-row shadow-sm shadow-amber-950/5">
      <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5" />
      <View className="flex-1">
        <Text className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
          महत्वपूर्ण निर्देश / Note:
        </Text>
        <HighlightText
          text={block.t || ''}
          query={query}
          className="text-sm font-medium text-amber-950 dark:text-amber-100 leading-6"
        />
      </View>
    </View>
  );
}

// ── Block: law ─────────────────────────────────────────────────────────────
function LawBlock({
  block,
  query,
  onLawPress,
}: {
  block: SopBlock;
  query: string;
  onLawPress?: (oldLaw: string, newLaws: string[]) => void;
}) {
  const items = Array.isArray(block.items) ? block.items : [];
  const figs = Array.isArray(block.figs) ? block.figs : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      <View className="gap-2">
        {items.map((it, idx) => (
          <View
            key={`lw-${idx}`}
            className="flex-row items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20"
          >
            <Text className="text-xs font-bold text-primary">⚖️</Text>
            <HighlightText
              text={String(it)}
              query={query}
              className="text-sm font-medium text-foreground flex-1"
            />
          </View>
        ))}
      </View>

      {figs.map((f, i) => (
        <SopImage key={`law-fig-${i}`} id={f.id} cap={f.cap} sens={f.sens} />
      ))}
    </View>
  );
}

// ── Block: devices ─────────────────────────────────────────────────────────
function DevicesBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];

  return (
    <View className="gap-3">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}

      <View className="gap-2.5">
        {items.map((it, idx) => (
          <View
            key={`dev-${idx}`}
            className="bg-card border border-border rounded-2xl p-4 gap-2 shadow-sm shadow-black/5"
          >
            <HighlightText
              text={it.t}
              query={query}
              className="text-sm font-bold text-foreground"
            />
            {it.d ? (
              <HighlightText
                text={it.d}
                query={query}
                className="text-sm text-muted-foreground leading-5"
              />
            ) : null}
            {it.img ? <SopImage id={it.img} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Block: two ─────────────────────────────────────────────────────────────
function TwoBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];
  const figs = Array.isArray(block.figs) ? block.figs : [];

  return (
    <View className="gap-2.5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground px-1"
        />
      ) : null}

      <View className="flex-row flex-wrap gap-2.5">
        {items.map((it, idx) => (
          <View
            key={`two-${idx}`}
            className="flex-1 min-w-[280px] bg-card border border-border rounded-2xl p-4 gap-1.5 shadow-sm shadow-black/5"
          >
            <HighlightText
              text={it.t}
              query={query}
              className="text-sm font-bold text-foreground"
            />
            {it.d ? (
              <HighlightText
                text={it.d}
                query={query}
                className="text-sm text-muted-foreground leading-5"
              />
            ) : null}
          </View>
        ))}
      </View>

      {figs.map((f, i) => (
        <SopImage key={`two-fig-${i}`} id={f.id} cap={f.cap} sens={f.sens} />
      ))}
    </View>
  );
}

// ── Block: flow (Vertical flow with arrows between boxes) ──────────────────
function FlowBlock({ block, query }: { block: SopBlock; query: string }) {
  const steps = Array.isArray(block.steps) ? block.steps : [];
  const figs = Array.isArray(block.figs) ? block.figs : [];
  const seize = Array.isArray(block.seize) ? block.seize : [];
  const transport = Array.isArray(block.transport) ? block.transport : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      <View className="gap-1 items-center">
        {steps.map((st, idx) => (
          <React.Fragment key={`fl-${idx}`}>
            <View className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 items-center">
              <HighlightText
                text={st}
                query={query}
                className="text-sm font-bold text-primary text-center leading-5"
              />
            </View>
            {idx < steps.length - 1 ? (
              <View className="my-1 items-center justify-center">
                <ArrowDown size={18} className="text-primary opacity-60" />
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>

      {seize.length > 0 ? (
        <View className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/50 gap-1.5">
          <Text className="text-xs font-bold text-primary uppercase">जब्ती / संकलन चरण:</Text>
          {seize.map((sz: string, sIdx: number) => (
            <View key={`sz-${sIdx}`} className="flex-row items-start gap-1.5">
              <Text className="text-xs text-muted-foreground">•</Text>
              <HighlightText text={sz} query={query} className="text-xs text-foreground flex-1" />
            </View>
          ))}
        </View>
      ) : null}

      {transport.length > 0 ? (
        <View className="mt-1 p-3 rounded-xl bg-muted/30 border border-border/50 gap-1.5">
          <Text className="text-xs font-bold text-primary uppercase">परिवहन / सुरक्षा:</Text>
          {transport.map((tr: string, tIdx: number) => (
            <View key={`tr-${tIdx}`} className="flex-row items-start gap-1.5">
              <Text className="text-xs text-muted-foreground">•</Text>
              <HighlightText text={tr} query={query} className="text-xs text-foreground flex-1" />
            </View>
          ))}
        </View>
      ) : null}

      {figs.map((f, i) => (
        <SopImage key={`flow-fig-${i}`} id={f.id} cap={f.cap} sens={f.sens} />
      ))}
    </View>
  );
}

// ── Block: terms (Glossary) ────────────────────────────────────────────────
function TermsBlock({ block, query }: { block: SopBlock; query: string }) {
  const items = Array.isArray(block.items) ? block.items : [];

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5">
      {block.h ? (
        <HighlightText
          text={block.h}
          query={query}
          className="text-base font-bold text-foreground border-b border-border/60 pb-2"
        />
      ) : null}

      <View className="gap-2.5">
        {items.map((it, idx) => (
          <View key={`tm-${idx}`} className="gap-0.5 border-b border-border/30 pb-2">
            <HighlightText
              text={it.t}
              query={query}
              className="text-sm font-bold text-foreground"
            />
            {it.d ? (
              <HighlightText
                text={it.d}
                query={query}
                className="text-xs text-muted-foreground leading-5"
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Fallback Block (never crashes on unknown k) ────────────────────────────
function FallbackBlock({ block, query }: { block: SopBlock; query: string }) {
  // Extract all string values from block
  const strings: string[] = [];
  const collect = (v: any) => {
    if (!v) return;
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(block);

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-2 shadow-sm shadow-black/5">
      <Text className="text-xs font-semibold text-muted-foreground uppercase">
        {block.k || 'जानकारी'}
      </Text>
      <View className="gap-1.5">
        {strings.map((str, idx) => (
          <View key={`fb-${idx}`} className="flex-row items-start gap-2">
            <Text className="text-xs text-primary font-bold mt-1">•</Text>
            <HighlightText
              text={str}
              query={query}
              className="text-sm text-foreground flex-1 leading-5"
            />
          </View>
        ))}
      </View>
    </View>
  );
}
