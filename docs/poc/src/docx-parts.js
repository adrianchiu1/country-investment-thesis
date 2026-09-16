const STYLE = (id, name, base, def) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${base ? `<w:basedOn w:val="${base}"/>` : ''}${def}</w:style>`;
function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W}>`
    + `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>`
    + STYLE('Normal', 'Normal', '', '<w:pPr><w:spacing w:after="120"/></w:pPr>')
    + STYLE('CITTitle', 'CIT Title', 'Normal', '<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr>')
    + STYLE('CITMeta', 'CIT Meta', 'Normal', '<w:rPr><w:i/><w:color w:val="767676"/></w:rPr>')
    + STYLE('CITH1', 'CIT Heading 1', 'Normal', '<w:pPr><w:spacing w:before="320" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr>')
    + STYLE('CITH2', 'CIT Heading 2', 'Normal', '<w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr>')
    + STYLE('CITH3', 'CIT Heading 3', 'Normal', '<w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4E79"/><w:sz w:val="22"/></w:rPr>')
    + STYLE('CITIssueTitle', 'CIT Issue Title', 'Normal', '<w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr>')
    + STYLE('CITBullet', 'CIT Bullet', 'Normal', '<w:pPr><w:ind w:left="360" w:hanging="360"/><w:spacing w:after="60"/></w:pPr>')
    + STYLE('CITBullet2', 'CIT Bullet 2', 'Normal', '<w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="60"/></w:pPr>')
    + STYLE('CITBody', 'CIT Body', 'Normal', '')
    + STYLE('CITPlaceholder', 'CIT Placeholder', 'Normal', "<w:rPr><w:i/><w:color w:val=\"8A8F96\"/></w:rPr>")
    + STYLE('CITTableHead', 'CIT Table Head', 'Normal', '<w:rPr><w:b/><w:color w:val="767676"/></w:rPr>')
    + `<w:style w:type="table" w:styleId="CITTable"><w:name w:val="CIT Table"/><w:tblPr><w:tblBorders>`
    + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D0D0D0"/>`).join('')
    + `</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`
    + `</w:styles>`;
}
function buildNumbering() {
  const lvl = (i, ch, ind) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${ch}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${ind}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering ${W}>`
    + `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvl(0, '', 360)}${lvl(1, 'o', 720)}</w:abstractNum>`
    + `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
}
async function docxWrite(eco) {
  return zipWrite([
    { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>` },
    { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>` },
    { name: 'word/document.xml', text: buildDocument(eco) },
    { name: 'word/styles.xml', text: buildStyles() },
    { name: 'word/numbering.xml', text: buildNumbering() },
  ]);
}

