import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X, Check, RefreshCw, AlertCircle, Sparkles } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { extractFieldsFromImage, normalizeMimeType, type FieldSpec } from '@/lib/ocrService';

interface OcrScanModalProps {
  visible: boolean;
  onClose: () => void;
  fields: FieldSpec[];
  onApply: (extracted: Record<string, string>) => void;
  title?: string;
}

export function OcrScanModal({
  visible,
  onClose,
  fields,
  onApply,
  title = 'Document OCR Scanner',
}: OcrScanModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? THEME.dark : THEME.light;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedValues, setExtractedValues] = useState<Record<string, string>>({});
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);

  const resetState = () => {
    setImageUri(null);
    setImageBase64(null);
    setMimeType('image/jpeg');
    setLoading(false);
    setError(null);
    setExtractedValues({});
    setHasExtracted(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processImage = async (uri: string, base64: string | null | undefined, rawMime?: string | null) => {
    if (!base64) {
      setError('Could not extract image data. Please try another image.');
      return;
    }

    const resolvedMime = normalizeMimeType(uri, rawMime);
    setImageUri(uri);
    setImageBase64(base64);
    setMimeType(resolvedMime);
    setError(null);
    setLoading(true);

    try {
      const res = await extractFieldsFromImage(base64, resolvedMime, fields);
      if (res.error) {
        setError(res.error);
      } else if (res.fields) {
        setExtractedValues(res.fields);
        setHasExtracted(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error extracting text from document.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is required to capture documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processImage(asset.uri, asset.base64, asset.mimeType);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch camera.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library permission is required to select document photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processImage(asset.uri, asset.base64, asset.mimeType);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to select image.');
    }
  };

  const handleValueChange = (key: string, val: string) => {
    setExtractedValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleApply = () => {
    onApply(extractedValues);
    handleClose();
  };

  const countFilled = Object.values(extractedValues).filter((v) => v && v.trim().length > 0).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="bg-card border-t border-border rounded-t-3xl max-h-[90%] overflow-hidden flex-col"
          style={{ borderCurve: 'continuous' }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                <Sparkles size={16} color="#2D52B8" />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">{title}</Text>
                <Text className="text-xs text-muted-foreground">AI-powered Hindi/English document field extraction</Text>
              </View>
            </View>
            <Pressable
              onPress={handleClose}
              className="w-8 h-8 rounded-full bg-secondary items-center justify-center active:opacity-60"
            >
              <X size={16} color={palette.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Error banner */}
            {error ? (
              <View className="flex-row items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle size={18} color="#DC2626" className="mt-0.5" />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-destructive mb-0.5">Extraction Notice</Text>
                  <Text className="text-xs text-destructive/90 leading-4">{error}</Text>
                  {error.toLowerCase().includes('api key') && (
                    <Text className="text-[11px] text-destructive/80 mt-1">
                      To configure: add GEMINI_API_KEY as a secret in Supabase Dashboard.
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {/* Step 1: No Image Picked */}
            {!imageUri && !loading && (
              <View className="gap-4 my-2">
                <View className="p-4 rounded-2xl bg-secondary/50 border border-border gap-2">
                  <Text className="text-sm font-semibold text-foreground">Select a Document or Note</Text>
                  <Text className="text-xs text-muted-foreground leading-4">
                    Capture or upload a clear photo of an identity card (Aadhaar, Voter ID), handwritten complaint, notice, or form. The AI will extract relevant details in Hindi and English.
                  </Text>
                </View>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handlePickCamera}
                    className="flex-1 items-center justify-center p-5 rounded-2xl bg-primary active:opacity-80 gap-2 shadow-sm"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Camera size={26} color="#FFFFFF" />
                    <Text className="text-sm font-semibold text-white">Capture Photo</Text>
                    <Text className="text-[11px] text-white/80">Take a photo with camera</Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickGallery}
                    className="flex-1 items-center justify-center p-5 rounded-2xl bg-card border border-border active:opacity-80 gap-2"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <ImageIcon size={26} color="#2D52B8" />
                    <Text className="text-sm font-semibold text-foreground">Pick from Gallery</Text>
                    <Text className="text-[11px] text-muted-foreground">Select existing image</Text>
                  </Pressable>
                </View>

                {/* Target Fields preview */}
                <View className="mt-3">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Fields to be extracted ({fields.length})
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {fields.map((f) => (
                      <View key={f.key} className="px-2.5 py-1 rounded-lg bg-secondary border border-border">
                        <Text className="text-xs text-foreground">{f.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Step 2: Loading State */}
            {loading && (
              <View className="items-center justify-center py-12 gap-4">
                <ActivityIndicator size="large" color="#2D52B8" />
                <View className="items-center gap-1">
                  <Text className="text-sm font-semibold text-foreground">Scanning document with Gemini AI...</Text>
                  <Text className="text-xs text-muted-foreground text-center">
                    Reading handwritten and printed text in Hindi & English
                  </Text>
                </View>
                {imageUri ? (
                  <View className="w-32 h-32 rounded-xl overflow-hidden border border-border mt-2 opacity-60">
                    <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                  </View>
                ) : null}
              </View>
            )}

            {/* Step 3: Extracted Results View & Edit */}
            {hasExtracted && !loading && (
              <View className="gap-4">
                {/* Header info */}
                <View className="flex-row items-center justify-between p-3 rounded-xl bg-secondary/60 border border-border">
                  <View className="flex-row items-center gap-2">
                    <Check size={16} color="#16A34A" />
                    <Text className="text-xs font-medium text-foreground">
                      Extracted {countFilled} of {fields.length} fields
                    </Text>
                  </View>
                  <Pressable
                    onPress={resetState}
                    className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border active:opacity-70"
                  >
                    <RefreshCw size={12} color={palette.mutedForeground} />
                    <Text className="text-xs text-muted-foreground">Re-scan</Text>
                  </Pressable>
                </View>

                {/* Review / Edit Fields */}
                <View className="gap-3">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Review & Edit Extracted Information
                  </Text>
                  {fields.map((f) => {
                    const val = extractedValues[f.key] ?? '';
                    const isFilled = val.trim().length > 0;
                    return (
                      <View key={f.key} className="gap-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs font-semibold text-foreground">{f.label}</Text>
                          {isFilled ? (
                            <Text className="text-[10px] text-green-600 font-medium">Found</Text>
                          ) : (
                            <Text className="text-[10px] text-muted-foreground">Not found in document</Text>
                          )}
                        </View>
                        <TextInput
                          value={val}
                          onChangeText={(text) => handleValueChange(f.key, text)}
                          placeholder={`Enter ${f.label}`}
                          placeholderTextColor={palette.mutedForeground}
                          className="px-3.5 py-2.5 rounded-xl border text-sm text-foreground bg-background"
                          style={{
                            borderColor: isFilled ? '#2D52B840' : palette.border,
                            borderCurve: 'continuous',
                          }}
                        />
                      </View>
                    );
                  })}
                </View>

                {/* Apply Button */}
                <View className="pt-2 gap-2">
                  <Pressable
                    onPress={handleApply}
                    className="items-center justify-center py-3.5 rounded-xl bg-primary active:opacity-80 shadow-sm"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-sm font-semibold text-white">
                      Apply Extracted Fields to Form
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleClose}
                    className="items-center justify-center py-2.5 rounded-xl active:opacity-60"
                  >
                    <Text className="text-xs text-muted-foreground">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
