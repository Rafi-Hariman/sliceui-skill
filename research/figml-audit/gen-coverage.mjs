// Generate field-coverage.csv + coverage summary (FASE 3).
// Columns: category,node_type,property,figma_api_support,observed_in_figml,figml_representation,parsed_by_sliceui,parser_location,present_in_transcript,transcript_location,required_for_angular,priority,status,evidence,notes
import { writeFileSync } from "node:fs";

// status ∈ preserved-exact | preserved-normalized | renamed | flattened | omitted-default
//         | omitted-noncritical | omitted-critical | unsupported-by-figml | unsupported-by-sliceui
//         | inferred | ambiguous | not-observed | needs-fixture | needs-verification
const R = [
// category            node_type  property                       api figml rep                     parsed   parser_loc        in_transcript   transcript_loc       ang     prio  status                evidence                                                  notes
["hierarchy","all","parent-child nesting","yes","yes","<children> recursive","yes","figml-parse.mjs:281,301;raw-graph.mjs:61-90","yes","layout[].children","yes","P0","preserved-exact","figml-parse.mjs:281 walkNodes recursion",""],
["hierarchy","all","child order (z/scene)","yes","yes","DOM order","yes","preserveOrder:true (figml-parse.mjs:16)","yes","layout[] array order","yes","P0","preserved-exact","figml-parse.mjs:16; test resolve.test.mjs:724","order = scene order"],
["identity","all","node id","yes","yes","id='16601:46203' / 'I…;12:101'","yes","idOf() figml-parse.mjs:630-634","yes","layout[].id","yes","P0","preserved-normalized","figml-parse.mjs:210 idOf(id,name)","':' and ';' → '_'"],
["identity","all","duplicate layer names","n/a","yes","same name, distinct id","partial","idOf fallback uses global _idSeq (629-634)","yes","distinct ids","no","P0","ambiguous","figml-parse.mjs:629 module-global _idSeq","no-name nodes get seq ids; counter not reset across parseFigml calls in-process"],
["content","TEXT","text (characters)","yes","yes","characters attr","yes","figml-parse.mjs:233","yes","node.text","yes","P0","preserved-exact","figml-parse.mjs:233 attrs.characters","exact, no OCR"],
["content","TEXT","rich text / mixed font","yes","partial","fontName='Symbol(figma.mixed)' + child <fontName>","no","SKIP_TAGS includes fontName (figml-parse.mjs:122-126)","no","—","yes","P1","omitted-critical","figml-parse.mjs:124 fontName in SKIP_TAGS; fontFamily() reads attrs.fontName string only","mixed-font spans lost; family never surfaces"],
["content","TEXT","line breaks","yes","not-observed","—","—","—","—","—","yes","P0","needs-fixture","no fixture with \\n in characters","[NEEDS FIGML EXPORT]"],
["content","TEXT","unicode/emoji/RTL","yes","partial","characters verbatim","yes","figml-parse.mjs:233","yes","node.text","yes","P0","preserved-exact","tester.xml + mahasiswa-tarif PUA glyphs","PUA FA glyph chars leak raw ('' '' '')"],
["content","all","visibility (hidden)","yes","yes","visible=false / opacity=0 / override visible","yes","isHidden figml-parse.mjs:402-407; overrideHidesNode 414","yes","node.hidden","yes","P0","preserved-exact","figml-parse.mjs:218,402-407","hidden surfaced, not dropped"],
["geometry","all","x/y/w/h","yes","yes","x,y,width,height attrs","yes","figml-parse.mjs:195-198","yes","node.x/y/w/h","yes","P0","preserved-normalized","figml-parse.mjs:211-214 Math.round","decimal coords rounded to px"],
["layout","FRAME/INSTANCE","auto layout mode","yes","yes","layoutMode=VERTICAL/HORIZONTAL","yes","figml-parse.mjs:266,288","yes","node.axis (row/column)","yes","P0","renamed","figml-parse.mjs:266","layoutMode→axis"],
["layout","FRAME/INSTANCE","padding","yes","yes","paddingLeft/Right/Top/Bottom + h/v","yes","paddingOf figml-parse.mjs:536-543","yes","node.padding","yes","P1","preserved-exact","figml-parse.mjs:273",""],
["layout","FRAME/INSTANCE","gap / itemSpacing","yes","yes","itemSpacing","yes","figml-parse.mjs:276,296","yes","node.gap","yes","P1","preserved-exact","figml-parse.mjs:276","SPACE_BETWEEN→justify"],
["layout","FRAME/INSTANCE","alignment primary/counter","yes","yes","primaryAxisAlignItems/counterAxisAlignItems","yes","sizingFields figml-parse.mjs:345-352","no","— (alignPrimary/alignCounter dead)","yes","P1","omitted-critical","figml-parse.mjs:349-350; agent report: only read at inspect.mjs:62",""],
["layout","FRAME/INSTANCE","sizing FILL/HUG","yes","yes","layoutSizingHorizontal/Vertical","yes","sizingFields figml-parse.mjs:345-352","partial","sizingH only via inspect.mjs:62 reword; sizingV dead","yes","P1","omitted-critical","figml-parse.mjs:347-348; agent report","responsive FILL/HUG lost in transcript.md/spec"],
["layout","all","layoutGrow","yes","yes","layoutGrow='1'","no(legacy)/yes(raw)","raw-graph.mjs:168","no","—","yes","P2","omitted-noncritical","raw-graph.mjs:168 layoutOf.grow","flex-grow present only in raw-graph"],
["layout","all","absolute positioning","yes","yes","layoutPositioning=ABSOLUTE","no(legacy)/yes(raw)","raw-graph.mjs:170","no","—","yes","P1","omitted-critical","raw-graph.mjs:170; Line layoutPositioning=ABSOLUTE","absolute child in auto-layout not surfaced to agent"],
["layout","all","constraints","yes","yes","<constraints horizontal vertical>","no","SKIP_TAGS figml-parse.mjs:123","no","—","yes","P1","omitted-critical","figml-parse.mjs:123","responsive constraint (SCALE/CENTER/MIN) dropped"],
["layout","FRAME/INSTANCE","clipsContent","yes","yes","clipsContent=true","no(legacy)/yes(raw)","raw-graph.mjs:178","no","—","no","P2","omitted-noncritical","raw-graph.mjs:178",""],
["typography","TEXT","font family","yes","yes","<fontName family=style>","no","fontFamily() figml-parse.mjs:528-533 reads attrs.fontName only","no","—","yes","P1","omitted-critical","figml-parse.mjs:528; render-transcript.mjs styleSummary omits family","family never rendered"],
["typography","TEXT","font size","yes","yes","fontSize","yes","figml-parse.mjs:224","yes","node.style.size","yes","P0","preserved-exact","figml-parse.mjs:224",""],
["typography","TEXT","font weight","yes","yes","fontWeight (int or '')","yes","figml-parse.mjs:225","yes","node.style.weight","yes","P0","preserved-exact","figml-parse.mjs:225","'' → undefined"],
["typography","TEXT","line height","yes","yes","<lineHeight unit value>","yes","childNumAttr figml-parse.mjs:556-565","yes","node.style.lineHeight","yes","P1","preserved-exact","figml-parse.mjs:229-231","AUTO→undefined"],
["typography","TEXT","letter spacing","yes","yes","<letterSpacing value unit>","yes","childNumAttr figml-parse.mjs:556-565","partial","style.letterSpacing (never rendered)","no","P2","omitted-noncritical","figml-parse.mjs:232; render-transcript omits ls? (styleSummary:135)","render does emit ls, but inspect/spec don't"],
["typography","TEXT","text align","yes","yes","textAlignHorizontal/Vertical","no","—","no","—","yes","P2","omitted-noncritical","not parsed",""],
["color","all","fill color","yes","yes","<fill color> (hex-6)","yes","colorOf figml-parse.mjs:380-398","yes","node.bg / style.color","yes","P1","preserved-exact","figml-parse.mjs:380","first visible fill only, lowercased"],
["color","all","fill opacity / alpha","yes","partial","opacity attr (decimal) only; no fill alpha","partial","isHidden uses ==0 only (402-407)","no","—","yes","P1","omitted-critical","figml-parse.mjs:404 opacity==0; node opacity never set","partial opacity (0.4) lost; only hidden detection"],
["color","all","multiple fills","yes","yes","multiple <fill> siblings","no","colorOf returns first (393-397)","no","—","yes","P2","omitted-noncritical","figml-parse.mjs:393 for..of returns first","raw-graph keeps all (raw-graph.mjs:207-215)"],
["color","all","gradient fill","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","no gradient element in fixtures","[NEEDS FIGML EXPORT]"],
["color","all","image fill","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","no image fill in fixtures","[NEEDS FIGML EXPORT]"],
["style","all","stroke / border","yes","yes","<stroke color> + strokeWeight","yes","borderOf figml-parse.mjs:456-477","yes","node.border","yes","P1","preserved-exact","figml-parse.mjs:456","fill vs stroke distinct"],
["style","all","stroke per side / mixed","yes","not-observed","—","—","—","—","—","yes","P2","needs-fixture","","[NEEDS FIGML EXPORT]"],
["style","all","corner radius (uniform)","yes","yes","cornerRadius","yes","figml-parse.mjs:204","yes","node.radius","yes","P1","preserved-exact","figml-parse.mjs:204",""],
["style","all","per-corner radius","yes","yes","topLeft/topRight/bottomRight/bottomLeftRadius","yes","perCornerRadius figml-parse.mjs:441-451","yes","node.cornerRadius","yes","P1","preserved-exact","figml-parse.mjs:441","asymmetric only"],
["style","all","blend mode","yes","yes","blendMode=NORMAL","no","—","no","—","no","P2","omitted-default","fill.stroke blendMode observed NORMAL only; not parsed","non-NORMAL would be omitted-critical"],
["effects","all","shadow","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","no <effect> in fixtures","[NEEDS FIGML EXPORT]"],
["effects","all","blur","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","","[NEEDS FIGML EXPORT]"],
["effects","all","mask / clipping","yes","partial","maskType=ALPHA, clipsContent=true","no(legacy)/yes(raw clipsContent)","raw-graph.mjs:178","no","—","no","P2","omitted-noncritical","maskType default ALPHA",""],
["component","INSTANCE","component identity (mainComponent)","yes","yes","<mainComponent id>","no","SKIP_TAGS figml-parse.mjs:125; raw-graph.mjs isMetadataTag:119","no","—","yes","P0","omitted-critical","figml-parse.mjs:125; raw-graph.mjs:116-120","component→instance relation lost in BOTH parsers"],
["component","INSTANCE","instance type","yes","yes","type=INSTANCE","yes","figml-parse.mjs:188","yes","node.type","yes","P0","preserved-exact","figml-parse.mjs:188",""],
["component","INSTANCE","variant (Type/Name)","yes","yes","<variantProperties Type Name>","yes","figml-parse.mjs:163-172","partial","node.variant / variantName (not directly rendered)","yes","P1","preserved-normalized","figml-parse.mjs:169-170,320","variant surfaced indirectly via resolve"],
["component","INSTANCE","required flag","yes","yes","<variantProperties required=true>","yes","requiredOf figml-parse.mjs:547-551","no","node.required DEAD (never surfaced)","yes","P1","omitted-critical","figml-parse.mjs:329; agent report: nobody reads .required","form required lost; only hidden-asterisk heuristic"],
["component","INSTANCE","instance overrides","yes","yes","<overrides><override><overriddenField>","partial","overrideHidesNode (visible only) figml-parse.mjs:414-436","no","—","yes","P1","omitted-critical","figml-parse.mjs:414-436","non-visible overrides (fill/text swap) dropped"],
["variables","all","variables / modes","yes","not-observed","—","—","—","no","—","yes","P1","needs-fixture","no variable binding element","[NEEDS FIGML EXPORT]"],
["styles","all","styles (textStyles)","yes","not-observed","textStyles in SKIP_TAGS","no","SKIP_TAGS figml-parse.mjs:125","no","—","yes","P1","needs-fixture","textStyles empty in fixtures","[NEEDS FIGML EXPORT]"],
["assets","all","image asset","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","","[NEEDS FIGML EXPORT]"],
["assets","all","export settings","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","","[NEEDS FIGML EXPORT]"],
["decorative","all","rotation","yes","not-observed","—","—","—","no","—","yes","P2","needs-fixture","","[NEEDS FIGML EXPORT]"],
["editor","all","expanded","yes","yes","expanded=true","no","—","no","—","no","P3","omitted-noncritical","layer panel state, editor-only","correctly dropped"],
];

const header = ["category","node_type","property","figma_api_support","observed_in_figml","figml_representation","parsed_by_sliceui","parser_location","present_in_transcript","transcript_location","required_for_angular","priority","status","evidence","notes"];
const esc = (v) => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
const lines = [header.join(","), ...R.map(r => r.map(esc).join(","))];
writeFileSync("research/figml-audit/field-coverage.csv", lines.join("\n") + "\n");

// coverage calc
function cov(prio) {
  const rows = R.filter(r => r[11] === prio && !["needs-fixture","not-observed"].includes(r[12]));
  const total = rows.length;
  const exact = rows.filter(r => r[12]==="preserved-exact").length;
  const usable = rows.filter(r => ["preserved-exact","preserved-normalized","renamed"].includes(r[12])).length;
  return { total, exact, usable };
}
const p0 = cov("P0"), p1 = cov("P1");
const criticalLoss = R.filter(r => r[12]==="omitted-critical").length;
const ambiguous = R.filter(r => r[12]==="ambiguous").length;
const inferred = R.filter(r => r[12]==="inferred").length;
const observedTotal = R.filter(r => r[4]==="yes" || r[4]==="partial").length;

const summary = {
  p0: { verified: p0.total, exact: p0.exact, usable: p0.usable, exactCoverage: +(p0.exact/p0.total).toFixed(3), usableCoverage: +(p0.usable/p0.total).toFixed(3) },
  p1: { verified: p1.total, exact: p1.exact, usable: p1.usable, exactCoverage: +(p1.exact/p1.total).toFixed(3), usableCoverage: +(p1.usable/p1.total).toFixed(3) },
  criticalLossCount: criticalLoss,
  ambiguousFieldCount: ambiguous,
  inferredFieldCount: inferred,
  totalObservedCoverage: observedTotal,
  totalFields: R.length,
};
writeFileSync("research/figml-audit/_coverage-summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
