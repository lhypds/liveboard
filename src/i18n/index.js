import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";
import ja from "./ja.json";
import boardConfig from "../../board.config.json";

const TITLE = {
  en: boardConfig.title?.en || "Liveboard",
  zh: boardConfig.title?.zh || "Liveboard",
  ja: boardConfig.title?.ja || "Liveboard",
};

const savedLang = localStorage.getItem("lang");
const browserLang = navigator.language.split("-")[0];
const defaultLang = savedLang || (["zh", "ja"].includes(browserLang) ? browserLang : "en");

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, home: { ...en.home, title: TITLE.en } } },
    zh: { translation: { ...zh, home: { ...zh.home, title: TITLE.zh } } },
    ja: { translation: { ...ja, home: { ...ja.home, title: TITLE.ja } } },
  },
  lng: defaultLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
