import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WatchCard } from './src/screens/WatchCard';
import { PAPER, SOOT } from './src/palette';
import { newGame } from './src/dbCore';
import { chapterAt, label, showsWatchCard } from './src/engine/watches';
import { readingOf } from './src/engine/fires';

type Screen = 'title' | 'card' | 'walk';

/**
 * Shell only. No navigation library - screens are components behind a
 * switch, per the house rule in AGENTS.md.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [save] = useState(() => newGame(0));
  const chapter = chapterAt(save.ordinal);

  if (screen === 'title') {
    return (
      <Pressable
        style={styles.fill}
        onPress={() => setScreen(showsWatchCard(chapter) ? 'card' : 'walk')}
      >
        <StatusBar hidden />
        <Text style={styles.hanzi}>走百病</Text>
        <Text style={styles.title}>HUNDRED ILLS</Text>
      </Pressable>
    );
  }

  if (screen === 'card') {
    return (
      <Pressable style={styles.fill} onPress={() => setScreen('walk')}>
        <StatusBar hidden />
        <WatchCard watch={chapter.watch} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.fill, styles.walk]}>
      <StatusBar hidden />
      <Text style={styles.chapter}>{label(chapter)}</Text>
      <Text style={styles.state}>she reads as {readingOf(save.fires)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SOOT },
  walk: { backgroundColor: PAPER },
  hanzi: { color: PAPER, fontSize: 52, letterSpacing: 10 },
  title: { color: PAPER, fontSize: 13, letterSpacing: 6, marginTop: 20, opacity: 0.55 },
  chapter: { color: SOOT, fontSize: 34, letterSpacing: 6 },
  state: { color: SOOT, fontSize: 13, marginTop: 14, opacity: 0.5 },
});
