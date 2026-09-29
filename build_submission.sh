#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$project_dir/docs/source"
editable_dir="$project_dir/docs/editable"
submission_dir="$project_dir/submission"

documents=(
  "01_SRS_Mohit_Singh_P_PES1UG24CS273"
  "02_Test_Plan_Atharv_More_PES1UG24CS276"
  "03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272"
  "04_Test_Case_Update_Muhammad_Affan_Dumba_PES1UG24CS280"
)

mkdir -p "$editable_dir" "$submission_dir"

for document in "${documents[@]}"; do
  weasyprint "$source_dir/$document.html" "$submission_dir/$document.pdf"
done

lo_profile="$(mktemp -d)"
intermediate_dir="$(mktemp -d)"
trap 'rm -rf "$lo_profile" "$intermediate_dir"' EXIT

for document in "${documents[@]}"; do
  libreoffice --headless \
    "-env:UserInstallation=file://$lo_profile" \
    --convert-to odt \
    --outdir "$intermediate_dir" \
    "$source_dir/$document.html" >/dev/null
  libreoffice --headless \
    "-env:UserInstallation=file://$lo_profile" \
    --convert-to docx:"Office Open XML Text" \
    --outdir "$editable_dir" \
    "$intermediate_dir/$document.odt" >/dev/null
done

embed_docx_images() {
  local docx_path="$1"
  shift
  local package_dir
  local repacked_path
  package_dir="$(mktemp -d)"
  repacked_path="$(mktemp --suffix=.docx)"
  rm -f "$repacked_path"
  unzip -q "$docx_path" -d "$package_dir"
  mkdir -p "$package_dir/word/media"
  for image_name in "$@"; do
    cp "$project_dir/assets/diagrams/$image_name" "$package_dir/word/media/$image_name"
    sed -i \
      "s|Target=\"file://$project_dir/assets/diagrams/$image_name\" TargetMode=\"External\"|Target=\"media/$image_name\"|g" \
      "$package_dir/word/_rels/document.xml.rels"
  done
  sed -i 's/r:link=/r:embed=/g' "$package_dir/word/document.xml"
  (cd "$package_dir" && zip -q -r "$repacked_path" .)
  mv "$repacked_path" "$docx_path"
  rm -rf "$package_dir"
}

embed_docx_images \
  "$editable_dir/${documents[0]}.docx" \
  "use_case.png"
embed_docx_images \
  "$editable_dir/${documents[2]}.docx" \
  "components.png" "sequence_booking.png" "sequence_cancellation.png"

pdfunite \
  "$submission_dir/${documents[0]}.pdf" \
  "$submission_dir/${documents[1]}.pdf" \
  "$submission_dir/${documents[2]}.pdf" \
  "$project_dir/docs/Team_E15_Railway_Reservation_System.pdf"

for document in "${documents[@]}"; do
  pdfinfo "$submission_dir/$document.pdf" | grep -q '^Pages:'
  pdftotext "$submission_dir/$document.pdf" "$intermediate_dir/$document.txt"
  grep -qi 'Team E15' "$intermediate_dir/$document.txt"
done

echo "Generated four submission PDFs in $submission_dir"
echo "Generated four editable DOCX files in $editable_dir"
echo "Regenerated the optional combined PDF in docs/"
