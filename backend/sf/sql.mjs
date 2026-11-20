export const BRNOW = "CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-03:00')";
export const NOWS = `DATE_FORMAT(${BRNOW},'%Y-%m-%dT%H:%i:%s')`;
export const HOJE = `DATE_FORMAT(${BRNOW},'%Y-%m-%d')`;
export const jo = (src, campo) => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT('{{${src}}}','$.${campo}')),'null')`;
export const ja = (src, campo) => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT('{{${src}}}', CONCAT('$[',S.N,'].${campo}'))),'null')`;
export const num = e => `CAST(${e} AS DECIMAL(14,2))`;
export const int = e => `CAST(${e} AS SIGNED)`;
