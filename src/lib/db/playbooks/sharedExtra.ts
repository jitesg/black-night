const C = 'culpable_homicide';
const S = 'sexual_harassment';
const H = 'human_trafficking_unlawful_compulsory_labour';
const T = 'sc_st_act';
const A = 'assault_criminal_force';
const ALL4 = [C, S, H, T];

export const SHARED_EXTRA: Record<string, string[]> = {
  COM_SCENE_SECURE: [C, H, T, A],
  COM_MLC: [C, H, T],
  COM_SCENE_PHOTO: [C, H, T, A],
  COM_SITE_PLAN: [C, T, A],
  COM_CCTV: [...ALL4, A],
  COM_EYEWITNESS: [...ALL4, A],
  COM_VICTIM_STMT: [...ALL4, A],
  COM_PHYS_EVIDENCE: [C, T, A],
  COM_FSL_SEND: [C, A],
  COM_FSL_REPORT: [C, A],
  COM_DIGITAL_CDR: [...ALL4, A],
  COM_FIN_TRAIL: [H, A],
  COM_ACCUSED_TRACE: [...ALL4, A],
  COM_ARREST_ASSESS: [...ALL4, A],
  COM_INTERROGATION: [...ALL4, A],
  COM_RECOVERY: [C, H, T],
  COM_CD_REVIEW: [...ALL4, A],
  COM_CHARGESHEET: [...ALL4, A],
};
