import { ScrollView, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

export default function MapScreen() {
  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Map View"
        showBack
      />
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <View className="w-16 h-16 rounded-2xl bg-accent items-center justify-center">
          <MapPin size={28} color="#2D52B8" />
        </View>
        <Text className="text-lg font-semibold text-foreground text-center">Map Integration</Text>
        <Text className="text-sm text-muted-foreground text-center leading-6">
          Full map view with GPS markers for religious places, social institutions and liquor shops. Add locations with GPS in Halka records to see them here.
        </Text>
      </View>
    </View>
  );
}
