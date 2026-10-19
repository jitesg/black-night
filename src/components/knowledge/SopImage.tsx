import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { ImageOff, AlertTriangle } from 'lucide-react-native';
import { getDatabase } from '../../lib/db/database';

export interface SopImageProps {
  id?: string;
  cap?: string;
  sens?: boolean;
  className?: string;
}

interface ImageDataRow {
  data: string;
  mime?: string;
}

export function SopImage({ id, cap, sens, className }: SopImageProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const db = await getDatabase();
        // Safe check on sop_images table
        const row = await db.getFirstAsync<ImageDataRow>(
          'SELECT data, mime FROM sop_images WHERE id = ? LIMIT 1',
          [id]
        );
        if (isMounted) {
          if (row && row.data) {
            setImageData(row.data);
            if (row.mime) setMimeType(row.mime);
          } else {
            setImageData(null);
          }
          setLoading(false);
        }
      } catch {
        // Table or row absent: graceful fallback to placeholder
        if (isMounted) {
          setImageData(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!id && !cap) return null;
  // Photos (sop_images) are not bundled yet: show nothing while loading and,
  // when the photo is missing, only its caption (no empty placeholder box).
  if (loading) return null;
  if (!imageData) {
    if (!cap) return null;
    return (
      <View className={`my-1.5 flex-row items-start gap-1.5 ${className || ''}`}>
        <Text textBreakStrategy="simple" className="flex-1 text-xs text-muted-foreground leading-relaxed">
          📷 {cap}
        </Text>
        {sens ? (
          <View className="flex-row items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <AlertTriangle size={11} color="#D97706" />
            <Text textBreakStrategy="simple" className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">संवेदनशील</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View className={`my-2 w-full rounded-xl overflow-hidden border border-border bg-muted/20 ${className || ''}`}>
      {imageData ? (
        <View className="relative w-full">
          <Image
            source={{ uri: imageData.startsWith('data:') ? imageData : `data:${mimeType};base64,${imageData}` }}
            resizeMode="contain"
            className="w-full h-48 bg-black/5"
          />
          {sens && (
            <View className="absolute top-2 right-2 bg-destructive/90 px-2 py-0.5 rounded flex-row items-center gap-1">
              <AlertTriangle size={12} color="#ffffff" />
              <Text className="text-[10px] text-destructive-foreground font-semibold">संवेदनशील</Text>
            </View>
          )}
        </View>
      ) : (
        <View className="py-5 px-4 items-center justify-center bg-muted/40">
          <View className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-1.5">
            <ImageOff size={18} className="text-muted-foreground opacity-60" />
          </View>
          <Text className="text-xs text-muted-foreground font-medium">फोटो उपलब्ध नहीं</Text>
          {sens && (
            <View className="mt-1 flex-row items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <AlertTriangle size={11} className="text-amber-600" />
              <Text className="text-[10px] text-amber-700 font-medium">संवेदनशील साक्ष्य</Text>
            </View>
          )}
        </View>
      )}

      {cap ? (
        <View className="p-2.5 bg-card/60 border-t border-border">
          <Text className="text-xs text-muted-foreground text-center leading-relaxed">
            📷 {cap}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
