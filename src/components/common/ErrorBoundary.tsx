/**
 * ErrorBoundary — global React error boundary.
 *
 * Catches any JS runtime error thrown inside the component tree below it and
 * displays a themed fallback UI instead of a blank white screen.
 *
 * In __DEV__: shows the full error message + component stack trace so the
 *   developer can read the root cause directly on screen.
 * In production: shows a friendly generic message with a "Try again" button
 *   that resets the boundary state (re-mounts the children).
 *
 * Usage (already wired into (app)/_layout.tsx):
 *   <ErrorBoundary>
 *     <Stack ... />
 *   </ErrorBoundary>
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

// Functional sub-component so we can use useState for press tracking
// (the parent is a class component — hooks are not allowed there).
function ResetButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        backgroundColor: pressed ? '#1B3358' : '#1E3A5F',
      }}
    >
      <RefreshCw size={16} color="#FFFFFF" strokeWidth={2} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
        Try Again
      </Text>
    </Pressable>
  );
}

// ─── Fallback UI (functional — can use hooks) ─────────────────────────────────
function ErrorFallback({
  error,
  componentStack,
  onReset,
}: {
  error: Error | null;
  componentStack: string | null;
  onReset: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 18,
            backgroundColor: colorScheme === 'dark' ? '#450a0a' : '#FEF2F2',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={30} color="#DC2626" strokeWidth={2} />
          </View>
        </View>

        {/* Heading */}
        <Text style={{
          fontSize: 18, fontWeight: '700', color: colors.foreground,
          textAlign: 'center', marginBottom: 8, letterSpacing: -0.3,
        }}>
          {__DEV__ ? 'Runtime Error' : 'Something went wrong'}
        </Text>

        {/* Subtitle */}
        <Text style={{
          fontSize: 14, color: colors.mutedForeground,
          textAlign: 'center', lineHeight: 20, marginBottom: 24,
        }}>
          {__DEV__
            ? 'A JavaScript error was caught by the Error Boundary.\nSee the details below.'
            : 'An unexpected error occurred. Please try again.'}
        </Text>

        {/* DEV: error message box */}
        {__DEV__ && error && (
          <View style={{
            backgroundColor: colorScheme === 'dark' ? '#450a0a' : '#FFF1F2',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#7f1d1d' : '#FECDD3',
            borderRadius: 10, padding: 14, marginBottom: 16,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: colorScheme === 'dark' ? '#fca5a5' : '#9F1239',
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Error
            </Text>
            <Text style={{
              fontSize: 13,
              color: colorScheme === 'dark' ? '#f87171' : '#BE123C',
              fontFamily: 'monospace', lineHeight: 18,
            }} selectable>
              {error.message}
            </Text>
          </View>
        )}

        {/* DEV: component stack box */}
        {__DEV__ && componentStack && (
          <View style={{
            backgroundColor: colors.muted,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, padding: 14, marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: colors.foreground,
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Component Stack
            </Text>
            <Text style={{
              fontSize: 11, color: colors.mutedForeground,
              fontFamily: 'monospace', lineHeight: 16,
            }} selectable>
              {componentStack.trim()}
            </Text>
          </View>
        )}

        {/* Reset button */}
        <ResetButton onPress={onReset} />
      </ScrollView>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('[ErrorBoundary] Caught error:', error?.message);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <ErrorFallback
        error={this.state.error}
        componentStack={this.state.componentStack}
        onReset={this.handleReset}
      />
    );
  }
}
