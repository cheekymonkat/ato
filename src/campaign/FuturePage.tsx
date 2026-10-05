import { Text, View } from 'react-native';
import { CampaignPage, campaignStyles as styles } from './CampaignPage';
export function FuturePage({ title, description }: { title: string; description: string }) {
  return <CampaignPage title={title}><View style={styles.panel}><Text accessibilityRole="header" style={styles.heading}>Planned feature</Text>
    <Text style={styles.body}>{description}</Text><Text style={styles.meta}>Use the header icons to return to your campaign or Argonauts.</Text>
  </View></CampaignPage>;
}
