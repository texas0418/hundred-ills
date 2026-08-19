import { StyleSheet, Text, View } from 'react-native';
import { WATCH_NAMES, WATCH_NAMES_EN } from '../engine/watches';
import { PAPER, SOOT } from '../palette';

/**
 * DECISIONS 88. The only chapter furniture in the game: five of these,
 * at the act breaks. No number, no progress bar, no continue button -
 * it holds for a few seconds and the night resumes.
 */
export function WatchCard({ watch }: { watch: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.hanzi}>{WATCH_NAMES[watch - 1]}</Text>
      <Text style={styles.english}>{WATCH_NAMES_EN[watch - 1]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOOT,
  },
  hanzi: { color: PAPER, fontSize: 64, letterSpacing: 8 },
  english: { color: PAPER, fontSize: 15, marginTop: 18, opacity: 0.6 },
});
