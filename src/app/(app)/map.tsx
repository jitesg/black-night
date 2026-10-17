import { ScrollView, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useTranslation } from 'react-i18next';

export default function MapScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('map.title')}
        showBack
      />
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <View className="w-16 h-16 rounded-2xl bg-accent items-center justify-center">
          <MapPin size={28} color="#2D52B8" />
        </View>
        <Text className="text-lg font-semibold text-foreground text-center">{t('map.integrationTitle')}</Text>
        <Text className="text-sm text-muted-foreground text-center leading-6">
          {t('map.integrationDesc')}
        </Text>
      </View>
    </View>
  );
}
