/**
 * CopLoader — app opening screen: police officer emblem with a soft pulse,
 * app name and animated dots (replaces the plain spinner).
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

export function CopEmblem({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="copBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2B5A8A" />
          <Stop offset="1" stopColor="#132C4A" />
        </LinearGradient>
        <LinearGradient id="copGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FDE68A" />
          <Stop offset="1" stopColor="#D4A017" />
        </LinearGradient>
        <ClipPath id="copClip">
          <Circle cx="100" cy="100" r="96" />
        </ClipPath>
      </Defs>
      <Circle cx="100" cy="100" r="96" fill="url(#copBg)" />
      <G clipPath="url(#copClip)">
        {/* uniform */}
        <Path d="M28 210 C30 168 60 148 100 148 C140 148 170 168 172 210 Z" fill="#C49A5A" />
        <Path d="M78 150 L100 178 L122 150 L112 146 L100 160 L88 146 Z" fill="#A87E40" />
        <Path d="M40 170 L72 156 L74 162 L44 177 Z" fill="#7A5A2A" />
        <Path d="M160 170 L128 156 L126 162 L156 177 Z" fill="#7A5A2A" />
        <Polygon points="134,170 137,177 145,177 139,182 141,190 134,185 127,190 129,182 123,177 131,177" fill="url(#copGold)" />
        <Rect x="58" y="176" width="24" height="6" rx="2" fill="#1F2A44" />
        {/* neck, ears, face */}
        <Path d="M88 128 L112 128 L114 152 Q100 160 86 152 Z" fill="#C98F62" />
        <Ellipse cx="70" cy="110" rx="6" ry="9" fill="#D9A273" />
        <Ellipse cx="130" cy="110" rx="6" ry="9" fill="#D9A273" />
        <Path d="M71 96 Q71 140 100 142 Q129 140 129 96 Z" fill="#E2AE7E" />
        {/* eyes, brows, nose, moustache, mouth */}
        <Ellipse cx="88" cy="111" rx="3.2" ry="3.6" fill="#1F2937" />
        <Ellipse cx="112" cy="111" rx="3.2" ry="3.6" fill="#1F2937" />
        <Path d="M81 103 Q88 99 95 103" stroke="#3B2A1A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <Path d="M105 103 Q112 99 119 103" stroke="#3B2A1A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <Path d="M100 110 Q97 119 101 121" stroke="#B9835A" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Path d="M84 127 Q92 120 100 124 Q108 120 116 127 Q108 126 100 128 Q92 126 84 127 Z" fill="#3B2A1A" />
        <Path d="M94 133 Q100 136 106 133" stroke="#9A5B3C" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* peaked cap */}
        <Path d="M56 86 C52 54 148 54 144 86 Z" fill="#C49A5A" />
        <Path d="M56 86 C52 54 148 54 144 86" fill="none" stroke="#A87E40" strokeWidth="2" />
        <Rect x="64" y="82" width="72" height="12" rx="3" fill="#7F1D1D" />
        <Path d="M62 92 Q100 102 138 92 L141 95 Q100 108 59 95 Z" fill="#111827" />
        <Circle cx="100" cy="74" r="9" fill="url(#copGold)" />
        <Polygon points="100,67 102.2,71.8 107.4,72.2 103.4,75.6 104.7,80.6 100,77.8 95.3,80.6 96.6,75.6 92.6,72.2 97.8,71.8" fill="#7F1D1D" />
      </G>
      <Circle cx="100" cy="100" r="96" fill="none" stroke="url(#copGold)" strokeWidth="4" />
    </Svg>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0.3, { duration: 400 }),
    ), -1));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.8 + v.value * 0.3 }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

export function CopLoader({ background, textColor, mutedColor, accent }: {
  background: string;
  textColor: string;
  mutedColor: string;
  accent: string;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const emblemStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.05 }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
      <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: '#D4A017' }, ringStyle]}
        />
        <Animated.View style={emblemStyle}>
          <CopEmblem size={140} />
        </Animated.View>
      </View>
      {/* Full-width, centred text with room for matras: a shrink-wrapped Hindi line is
          measured a little too narrow on Android and its last letters get cut. */}
      <Text style={{ alignSelf: 'stretch', textAlign: 'center', paddingHorizontal: 24, color: textColor, fontSize: 24, lineHeight: 34, fontWeight: '800', marginTop: 18, letterSpacing: 0.5 }}>InvestSuite</Text>
      <Text style={{ alignSelf: 'stretch', textAlign: 'center', paddingHorizontal: 24, color: mutedColor, fontSize: 14, lineHeight: 22, marginTop: 2 }}>विवेचना सहायक</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        <Dot delay={0} color={accent} />
        <Dot delay={150} color={accent} />
        <Dot delay={300} color={accent} />
      </View>
    </View>
  );
}
