import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WatchCard } from './src/screens/WatchCard';
import { Walk } from './src/screens/Walk';
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
  const [walkX, setWalkX] = useState(0);
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

  // Drag to walk. Real input, pacing and the fires all come later; this
  // is here so the parallax can be looked at on a device.
  return (
    <View style={styles.fill}>
      <StatusBar hidden />
      <Walk walkX={walkX} />
      <Pressable
        style={styles.overlay}
        onPress={() => setWalkX((x) => x + 120)}
      >
        <Text style={styles.chapter}>{label(chapter)}</Text>
        <Text style={styles.state}>she reads as {readingOf(save.fires)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SOOT },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 },
  hanzi: { color: PAPER, fontSize: 52, letterSpacing: 10 },
  title: { color: PAPER, fontSize: 13, letterSpacing: 6, marginTop: 20, opacity: 0.55 },
  chapter: { color: SOOT, fontSize: 28, letterSpacing: 6, opacity: 0.8 },
  state: { color: SOOT, fontSize: 12, marginTop: 10, opacity: 0.45 },
});
