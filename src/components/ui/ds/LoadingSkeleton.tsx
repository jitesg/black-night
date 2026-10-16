/**
 * LoadingSkeleton — shimmer placeholder for loading states.
 * Replaces spinners everywhere in the app.
 *
 * Usage:
 *   <LoadingSkeleton width="100%" height={20} radius={8} />
 *   <SkeletonList rows={5} />
 *   <SkeletonCard />
 */
import { memo, useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export interface LoadingSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export const LoadingSkeleton = memo(function LoadingSkeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: LoadingSkeletonProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: colorScheme === 'dark' ? '#2A2A2E' : c.border,
        },
        animStyle,
        style,
      ]}
    />
  );
});

// ── Pre-built skeleton layouts ────────────────────────────────────────────────

interface SkeletonListProps {
  rows?: number;
}

export const SkeletonList = memo(function SkeletonList({ rows = 5 }: SkeletonListProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  return (
    <View style={{ gap: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 0.5,
            borderBottomColor: c.border,
          }}
        >
          <LoadingSkeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <LoadingSkeleton width="60%" height={14} />
            <LoadingSkeleton width="40%" height={11} />
          </View>
          <LoadingSkeleton width={24} height={24} radius={4} />
        </View>
      ))}
    </View>
  );
});

export const SkeletonCard = memo(function SkeletonCard() {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: c.card,
        borderWidth: 0.5,
        borderColor: c.border,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <LoadingSkeleton width={40} height={40} radius={8} />
        <View style={{ flex: 1, gap: 8 }}>
          <LoadingSkeleton width="50%" height={14} />
          <LoadingSkeleton width="30%" height={11} />
        </View>
      </View>
      <LoadingSkeleton width="100%" height={11} />
      <LoadingSkeleton width="80%" height={11} />
    </View>
  );
});
