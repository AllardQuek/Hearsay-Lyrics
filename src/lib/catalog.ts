export interface ExampleSong {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  audioUrl?: string;
}

export const EXAMPLE_SONGS: ExampleSong[] = [
  {
    id: "dao-xiang",
    title: "稻香 (Dao Xiang)",
    artist: "Jay Chou",
    lyrics: `对这个世界如果你有太多的抱怨
跌倒了 就不敢继续往前走
为什么 人要这么的脆弱 堕落
请你打开电视看看
多少人为生命在努力勇敢的走下去
我们是不是该知足
珍惜一切 就算没有拥有`,
    audioUrl: "https://www.youtube.com/watch?v=s2-f67-8lU0",
  },
  {
    id: "yue-liang",
    title: "月亮代表我的心",
    artist: "Teresa Teng",
    lyrics: `你问我爱你有多深
我爱你有几分
我的情也真
我的爱也真
月亮代表我的心`,
    audioUrl: "https://www.youtube.com/watch?v=-SssiO_W6x8",
  },
];
