export interface ExampleSong {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  audioUrl?: string;
  // Pre-calculated hearsay lines (optional, for demo speed)
  preComputedLines?: any[]; 
}

export const EXAMPLE_SONGS: ExampleSong[] = [
  {
    id: "love-confession",
    title: "告白氣球 (Love Confession)",
    artist: "Jay Chou",
    lyrics: `塞納河畔 左岸的咖啡
我手一杯 品嚐你的美
留下唇印的嘴
花店玫瑰 名字寫錯誰
告白氣球 風吹到對街
微笑在天上飛

你說你有點難追 想讓我知難而退
禮物不需挑最貴 只要香榭的落葉
營造浪漫的約會 不害怕搞砸一切
擁有你就擁有 全世界

親愛的 愛上你 從那天起
甜蜜得很輕易
親愛的 別任性 你的眼睛
在說我願意`,
    audioUrl: "https://www.youtube.com/watch?v=bu7nU9Mhpyo",
    preComputedLines: [
      {
        chinese: "塞納河畔 左岸的咖啡",
        pinyin: "Sāinà hépàn Zuǒ'àn de kāfēi",
        startTime: 22.9,
        meaning: "By the Seine, coffee on the left bank",
        candidates: [{ text: "Say no her pen, sore and the cafe", phonetic: 0.9, humor: 0.8 }]
      },
      {
        chinese: "我手一杯 品嚐你的美",
        pinyin: "Wǒ shǒu yībēi pǐncháng nǐ dì měi",
        startTime: 25.4,
        meaning: "A cup in my hand, tasting your beauty",
        candidates: [{ text: "War show eat bay, pin chang knee the may", phonetic: 0.9, humor: 0.7 }]
      },
      {
        chinese: "留下唇印的嘴",
        pinyin: "Liú xià chún yìn de zuǐ",
        startTime: 28.4,
        meaning: "The mouth that left a lip print",
        candidates: [{ text: "Lose ya shorn in the sway", phonetic: 0.85, humor: 0.8 }]
      },
      {
        chinese: "花店玫瑰 名字寫錯誰",
        pinyin: "Huā diàn méiguī míngzì xiě cuò shuí",
        startTime: 32.9,
        meaning: "Rose from the flower shop, whose name was written wrong",
        candidates: [{ text: "Who are then may way, mean see share swore sway", phonetic: 0.9, humor: 0.8 }]
      },
      {
        chinese: "告白氣球 風吹到對街",
        pinyin: "Gàobái qìqiú fēngchuī dào duì jiē",
        startTime: 36.6,
        meaning: "Confession balloon, the wind blows to the street opposite",
        candidates: [{ text: "Go buy cheer chill, fun chew door day chair", phonetic: 0.9, humor: 0.8 }]
      },
      {
        chinese: "微笑在天上飛",
        pinyin: "Wéixiào zài tiānshàng fēi",
        startTime: 39.3,
        meaning: "Smile flying in the sky",
        candidates: [{ text: "Way shore sigh ten shark bay", phonetic: 0.95, humor: 0.7 }]
      },
      {
        chinese: "你說你有點難追",
        pinyin: "Nǐ shuō nǐ yǒudiǎn nán zhuī",
        startTime: 44.1,
        meaning: "You said you're a bit hard to chase",
        candidates: [{ text: "Knee sure knee your then none sway", phonetic: 0.85, humor: 0.9 }]
      },
      {
        chinese: "想讓我知難而退",
        pinyin: "Xiǎng ràng wǒ zhī nán ér tuì",
        startTime: 46.3,
        meaning: "Want me to give up",
        candidates: [{ text: "Shark run war she none are tray", phonetic: 0.9, humor: 0.8 }]
      },
      {
        chinese: "禮物不需挑最貴",
        pinyin: "Lǐwù bù xū tiāo zuì guì",
        startTime: 48.6,
        meaning: "Gifts don't need to be the most expensive",
        candidates: [{ text: "Lee woo bush she tell sway way", phonetic: 0.8, humor: 0.8 }]
      },
      {
        chinese: "只要香榭的落葉",
        pinyin: "Zhǐyào xiāng xiè de luòyè",
        startTime: 51.6,
        meaning: "Just fallen leaves from Champs-Élysées",
        candidates: [{ text: "She ya show she the law year", phonetic: 0.9, humor: 0.7 }]
      },
      {
        chinese: "喔～營造浪漫的約會",
        pinyin: "Ō~ Yíngzào làngmàn de yuēhuì",
        startTime: 54.1,
        meaning: "Oh~ Create a romantic date",
        candidates: [{ text: "Oh~ Ying sow long man the year way", phonetic: 0.85, humor: 0.8 }]
      },
      {
        chinese: "不害怕搞砸一切",
        pinyin: "Bù hàipà gǎo zá yīqiè",
        startTime: 57.1,
        meaning: "Not afraid of messing everything up",
        candidates: [{ text: "Bush hi par go sha eat chair", phonetic: 0.9, humor: 0.6 }]
      },
      {
        chinese: "擁有你就擁有 全世界",
        pinyin: "Yǒngyǒu nǐ jiù yǒngyǒu quán shìjiè",
        startTime: 59.6,
        meaning: "Having you means having the whole world",
        candidates: [{ text: "Yong your knee Joe yong your can she chair", phonetic: 0.9, humor: 0.7 }]
      },
      {
        chinese: "親愛的 愛上你 從那天起",
        pinyin: "Qīn'ài de ài shàng nǐ cóng nèitiān qǐ",
        startTime: 64.8,
        meaning: "Dear, fell in love with you starting from that day",
        candidates: [{ text: "Chin eye the eye shark knee, song nay ten she", phonetic: 0.9, humor: 0.8 }]
      },
      {
        chinese: "甜蜜得很輕易",
        pinyin: "Tiánmì de hěn qīngyì",
        startTime: 71.1,
        meaning: "Sweetness comes very easily",
        candidates: [{ text: "Ten me the hen ching eat", phonetic: 0.95, humor: 0.6 }]
      },
      {
        chinese: "親愛的 別任性 你的眼睛",
        pinyin: "Qīn'ài de bié rènxìng nǐ de yǎnjīng",
        startTime: 75.6,
        meaning: "Dear, don't be stubborn, your eyes",
        candidates: [{ text: "Chin eye the bell rain scene, knee the yen jing", phonetic: 0.9, humor: 0.7 }]
      },
      {
        chinese: "在說我願意",
        pinyin: "Zài shuō wǒ yuànyì",
        startTime: 81.6,
        meaning: "Are saying I do",
        candidates: [{ text: "Sigh shore war yen eat", phonetic: 0.95, humor: 0.7 }]
      }
    ]
  },
  {
    id: "yue-liang",
    title: "月亮代表我的心",
    artist: "Teresa Teng",
    lyrics: `你問我愛你有有多深
我愛你有幾分
我的情也真
我的愛也真
月亮代表我的心`,
    audioUrl: "https://www.youtube.com/watch?v=-SssiO_W6x8",
  },
];
