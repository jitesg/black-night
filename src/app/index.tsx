import { Redirect } from 'expo-router';
import { IS_OFFICE } from '@/office/config';

export default function Index() {
  // "InvestSuite कार्यालय" build → office screens; InvestSuite → home
  return <Redirect href={(IS_OFFICE ? '/office' : '/home') as never} />;
}
