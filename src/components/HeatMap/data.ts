type HeatFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { weight: number };
};

export type HeatData = {
  type: "FeatureCollection";
  features: HeatFeature[];
};

type Cluster = {
  name: string;
  center: [number, number];
  peak: number;
  spread?: number;
  count?: number;
};

const WARDS: Cluster[] = [
  { name: "Chiyoda", center: [139.7530, 35.6938], peak: 0.95 },
  { name: "Chuo", center: [139.7720, 35.6706], peak: 1.0 },
  { name: "Minato", center: [139.7515, 35.6585], peak: 0.95 },
  { name: "Shinjuku", center: [139.7036, 35.6938], peak: 1.0 },
  { name: "Bunkyo", center: [139.7522, 35.7081], peak: 0.6 },
  { name: "Taito", center: [139.7798, 35.7126], peak: 0.95 },
  { name: "Sumida", center: [139.8015, 35.7106], peak: 0.75 },
  { name: "Koto", center: [139.8174, 35.6731], peak: 0.7 },
  { name: "Shinagawa", center: [139.7302, 35.6092], peak: 0.85 },
  { name: "Meguro", center: [139.6982, 35.6415], peak: 0.7 },
  { name: "Ota", center: [139.7161, 35.5614], peak: 0.7 },
  { name: "Setagaya", center: [139.6532, 35.6464], peak: 0.65 },
  { name: "Shibuya", center: [139.7036, 35.6595], peak: 1.0 },
  { name: "Nakano", center: [139.6638, 35.7074], peak: 0.65 },
  { name: "Suginami", center: [139.6363, 35.6995], peak: 0.55 },
  { name: "Toshima", center: [139.7167, 35.7261], peak: 0.9 },
  { name: "Kita", center: [139.7336, 35.7528], peak: 0.5 },
  { name: "Arakawa", center: [139.7831, 35.7361], peak: 0.55 },
  { name: "Itabashi", center: [139.7095, 35.7512], peak: 0.5 },
  { name: "Nerima", center: [139.6516, 35.7357], peak: 0.5 },
  { name: "Adachi", center: [139.8043, 35.7750], peak: 0.55 },
  { name: "Katsushika", center: [139.8473, 35.7434], peak: 0.45 },
  { name: "Edogawa", center: [139.8683, 35.7066], peak: 0.5 },
];

const HOTSPOTS: Cluster[] = [
  { name: "Shibuya Crossing", center: [139.7005, 35.6595], peak: 1.0, spread: 0.003, count: 8 },
  { name: "Shinjuku Station", center: [139.6917, 35.6896], peak: 1.0, spread: 0.003, count: 8 },
  { name: "Ginza", center: [139.7671, 35.6712], peak: 1.0, spread: 0.003, count: 7 },
  { name: "Tokyo Station", center: [139.7671, 35.6812], peak: 0.95, spread: 0.003, count: 7 },
  { name: "Akihabara", center: [139.7745, 35.7022], peak: 0.9, spread: 0.003, count: 6 },
  { name: "Asakusa", center: [139.7967, 35.7148], peak: 0.9, spread: 0.003, count: 6 },
  { name: "Ueno", center: [139.7774, 35.7141], peak: 0.85, spread: 0.003, count: 6 },
  { name: "Roppongi", center: [139.7314, 35.6627], peak: 0.9, spread: 0.003, count: 6 },
  { name: "Ikebukuro", center: [139.7100, 35.7295], peak: 0.95, spread: 0.003, count: 7 },
  { name: "Shinagawa Station", center: [139.7387, 35.6285], peak: 0.85, spread: 0.003, count: 6 },
  { name: "Odaiba", center: [139.7770, 35.6260], peak: 0.7, spread: 0.004, count: 5 },
  { name: "Skytree", center: [139.8107, 35.7101], peak: 0.85, spread: 0.003, count: 6 },
  { name: "Naka-Meguro", center: [139.6986, 35.6437], peak: 0.7, spread: 0.003, count: 5 },
  { name: "Shimo-Kitazawa", center: [139.6680, 35.6612], peak: 0.7, spread: 0.003, count: 5 },
  { name: "Jiyugaoka", center: [139.6688, 35.6075], peak: 0.65, spread: 0.003, count: 5 },
  { name: "Kitasenju", center: [139.8050, 35.7493], peak: 0.65, spread: 0.003, count: 5 },
  { name: "Kamata", center: [139.7155, 35.5616], peak: 0.7, spread: 0.003, count: 5 },
  { name: "Toyosu", center: [139.7960, 35.6549], peak: 0.7, spread: 0.003, count: 5 },
  { name: "Tsukishima", center: [139.7793, 35.6651], peak: 0.6, spread: 0.003, count: 4 },
];

// Golden-angle scatter so points fill the disk evenly without clumping.
function buildCluster({ center, peak, spread = 0.006, count = 6 }: Cluster): Array<[number, number, number]> {
  const [lng, lat] = center;
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.3999632297;
    const r = spread * Math.sqrt((i + 0.5) / count);
    const dx = r * Math.cos(angle);
    const dy = r * Math.sin(angle);
    const falloff = 1 - (i / count) * 0.45;
    points.push([lng + dx, lat + dy, +(peak * falloff).toFixed(3)]);
  }
  return points;
}

const POINTS: Array<[number, number, number]> = [
  ...WARDS.flatMap(buildCluster),
  ...HOTSPOTS.flatMap(buildCluster),
];

export const TOKYO_HEAT: HeatData = {
  type: "FeatureCollection",
  features: POINTS.map(([lng, lat, weight]) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { weight },
  })),
};
