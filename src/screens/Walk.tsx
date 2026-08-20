import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkImage,
  Rect,
  useImage,
} from '@shopify/react-native-skia';

import { PAPER } from '../palette';
import {
  PLANES,
  planeRect,
  scaledWidth,
  tilesFor,
  type Plane,
} from '../engine/parallax';

/**
 * The walk. Three plates sliding at different speeds.
 *
 * All the arithmetic lives in src/engine/parallax.ts so Node can test it
 * (test-parallax.ts, 60 assertions). This file only draws.
 *
 * Plates come from assets/plates-alpha - the paper is transparent there,
 * so the planes layer through each other the way washes on one sheet
 * would. The opaque versions stack into horizontal bands.
 */

const SOURCES = {
  far: require('../../assets/plates-alpha/canal-far.png'),
  mid: require('../../assets/plates-alpha/canal-mid.png'),
  kerb: require('../../assets/plates-alpha/canal-near-kerb.png'),
} as const;

function PlaneLayer({
  plane,
  walkX,
  screenW,
  screenH,
}: {
  plane: Plane;
  walkX: number;
  screenW: number;
  screenH: number;
}) {
  const image = useImage(SOURCES[plane.id]);
  const band = planeRect(plane, screenH);

  const tiles = useMemo(() => {
    if (!image) return [];
    const w = scaledWidth(plane, image.width(), image.height(), screenH);
    return tilesFor(plane, walkX, w, screenW).map((t) => ({ ...t, w }));
  }, [image, plane, walkX, screenW, screenH]);

  if (!image) return null;

  return (
    <Group>
      {tiles.map((t) => (
        <Group
          key={`${plane.id}:${t.index}`}
          // Mirroring alternate copies makes the wrap seam exactly zero.
          // Only safe on a plane with no distinctive feature - see the
          // note on Plane.mirror.
          transform={
            t.mirrored
              ? [{ translateX: t.x + t.w }, { scaleX: -1 }]
              : [{ translateX: t.x }]
          }
        >
          <SkImage
            image={image}
            x={0}
            y={band.y}
            width={t.w}
            height={band.height}
            fit="fill"
          />
        </Group>
      ))}
    </Group>
  );
}

export function Walk({ walkX }: { walkX: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <Canvas style={{ flex: 1 }}>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
      {PLANES.map((p) => (
        <PlaneLayer
          key={p.id}
          plane={p}
          walkX={walkX}
          screenW={width}
          screenH={height}
        />
      ))}
    </Canvas>
  );
}
