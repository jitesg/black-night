/** कागज़ — अगले चरण में (न्यायालय / प्रार्थना पत्र भेजना). */
import { Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { OfficeHeader, useOfficeColors } from '@/office/ui';
import { useMe } from '@/office/useMe';

export default function OfficeKagaz() {
  const C = useOfficeColors();
  const { me } = useMe();
  return (
    <>
      <OfficeHeader title="कागज़" subtitle={me ? `थाना ${me.thana.name}` : undefined} />
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <FileText size={42} color={C.muted} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>जल्द आ रहा है</Text>
        <Text style={{ fontSize: 13.5, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
          न्यायालय के कागज़ और प्रार्थना पत्र यहाँ से अधिकारी को भेजे जाएँगे (अगला चरण)।
        </Text>
      </View>
    </>
  );
}
