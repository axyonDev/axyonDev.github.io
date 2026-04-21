/**
 * AXYON LEARN — Kurs Tanımı
 * Bu dosyayı değiştirerek farklı kurs oluşturabilirsin.
 * Motor (index.html) hiç değişmez.
 */
window.AXYON_COURSE = {
  meta: {
    storageKey:  "axyon-python-v1",
    themeKey:    "axyon-python-theme",
    title:       "PyLab",
    brand:       "axyon.dev",
    icon:        "🐍",
    tagline:     "Derinlemesine Python Öğren",
    description: "Her konuda sadece ne değil, <strong>neden</strong> ve <strong>nasıl</strong> öğreniyorsun.",
    themeColor:  "#f0a500",
    codeRunner:  "skulpt"
  },

  /**
   * Modül listesi — sıra önemli
   * file: hangi JS dosyasını yükle
   * varName: o dosyanın window'a atadığı değişken adı
   * comingSoon: true ise kilitli görünür, yüklenmez
   */
  modules: [
    { id:"m0", file:"modules/m0.js", varName:"AXYON_M0" },
    { id:"m1", file:"modules/m1.js", varName:"AXYON_M1" },
    { id:"m2", file:"modules/m2.js", varName:"AXYON_M2" },
    { id:"m3", label:"Koleksiyonlar", icon:"📦", color:"#f78c6c", comingSoon:true },
    { id:"m4", label:"OOP & Sınıflar", icon:"🔷", color:"#89ddff", comingSoon:true }
  ]
};
