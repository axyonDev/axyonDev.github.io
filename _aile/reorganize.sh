#!/bin/bash
# AXYON - Klasör Yeniden Yapılandırma Scripti
# Çalıştır: bash reorganize.sh
# NOT: Projenin KÖK dizininde çalıştır (index.html ile aynı klasörde)

set -e

echo "🚀 AXYON klasör yapısı yeniden düzenleniyor..."

# --- Klasörleri oluştur ---
mkdir -p games
mkdir -p tools

echo "📁 games/ ve tools/ klasörleri oluşturuldu."

# --- Oyunları taşı ---
GAMES=(
  "axyon_sum_crystal_drop.html"
  "axyon_crystal_merge.html"
  "axyon_tetris_classic.html"
  "axyon_pegrix.html"
)

for file in "${GAMES[@]}"; do
  if [ -f "$file" ]; then
    # css/, js/, img/ yollarını ../ ile güncelle
    sed -i \
      -e 's|href="css/|href="../css/|g' \
      -e 's|href='\''css/|href='\''../css/|g' \
      -e 's|src="js/|src="../js/|g' \
      -e 's|src='\''js/|src='\''../js/|g' \
      -e 's|src="img/|src="../img/|g' \
      -e 's|src='\''img/|src='\''../img/|g' \
      -e 's|url(img/|url(../img/|g' \
      -e 's|url('\''img/|url('\''../img/|g' \
      -e 's|url("img/|url("../img/|g' \
      "$file"
    mv "$file" "games/$file"
    echo "  ✅ games/$file"
  else
    echo "  ⚠️  $file bulunamadı, atlandı."
  fi
done

# --- Araçları taşı ---
TOOLS=(
  "axyon_vignette-tool.html"
  "axyon_imsakiye.html"
  "axyon_zikirmatik.html"
)

for file in "${TOOLS[@]}"; do
  if [ -f "$file" ]; then
    sed -i \
      -e 's|href="css/|href="../css/|g' \
      -e 's|href='\''css/|href='\''../css/|g' \
      -e 's|src="js/|src="../js/|g' \
      -e 's|src='\''js/|src='\''../js/|g' \
      -e 's|src="img/|src="../img/|g' \
      -e 's|src='\''img/|src='\''../img/|g' \
      -e 's|url(img/|url(../img/|g' \
      -e 's|url('\''img/|url('\''../img/|g' \
      -e 's|url("img/|url("../img/|g' \
      "$file"
    mv "$file" "tools/$file"
    echo "  ✅ tools/$file"
  else
    echo "  ⚠️  $file bulunamadı, atlandı."
  fi
done

echo ""
echo "✨ Tamamlandı! Yeni yapı:"
echo ""
echo "  📄 index.html         ← GÜNCELLENMİŞ versiyonunu kullan"
echo "  📁 games/"
echo "  │   ├── axyon_sum_crystal_drop.html"
echo "  │   ├── axyon_crystal_merge.html"
echo "  │   ├── axyon_tetris_classic.html"
echo "  │   └── axyon_pegrix.html"
echo "  📁 tools/"
echo "  │   ├── axyon_vignette-tool.html"
echo "  │   ├── axyon_imsakiye.html"
echo "  │   └── axyon_zikirmatik.html"
echo "  📁 css/"
echo "  📁 js/"
echo "  📁 img/"
echo ""
echo "⚠️  index.html'i de indirdiğin güncellenmiş versiyonla değiştir!"
echo "⚠️  GitHub Pages kullanıyorsan: git add . && git commit -m 'refactor: klasör yapısı' && git push"
