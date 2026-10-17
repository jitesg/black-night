import { RAW as shared1Raw, LINKS as shared1Links } from './shared1';
import { RAW as shared2Raw, LINKS as shared2Links } from './shared2';
import { RAW as theftRaw } from './theftSteps';
import { RAW as hurtRaw } from './hurtSteps';
import { RAW as cheatingRaw } from './cheatingSteps';
import { RAW as roadAccidentRaw } from './roadAccidentSteps';
import { RAW as rapeRaw } from './rapeSteps';
import { RAW as pocsoRaw } from './pocsoSteps';
import { RAW as kidnappingRaw } from './kidnappingSteps';
import { RAW as robberyRaw } from './robberySteps';
import { RAW as cyberRaw } from './cyberSteps';
import { RAW as ndpsRaw } from './ndpsSteps';
import { RAW as armsRaw } from './armsSteps';
import { RAW as forgeryRaw } from './forgerySteps';
import { RAW as dowryRaw } from './dowryDeathSteps';
import { RAW as crueltyRaw } from './crueltySteps';
import { RAW as extortionRaw } from './extortionSteps';
import { RAW as breachRaw } from './breachTrustSteps';
import { RAW as trespassRaw } from './trespassSteps';
import { RAW as riotingRaw } from './riotingSteps';
import { RAW as culpableRaw } from './culpableSteps';
import { RAW as harassRaw } from './harassmentSteps';
import { RAW as traffickingRaw } from './traffickingSteps';
import { RAW as scstRaw } from './scstSteps';
import { RAW as abetmentRaw } from './abetmentSteps';

export const CRIME_FILES: Array<{ crimeKey: string; raw: string }> = [
  { crimeKey: 'THEFT', raw: theftRaw },
  { crimeKey: 'HURT', raw: hurtRaw },
  { crimeKey: 'CHEATING', raw: cheatingRaw },
  { crimeKey: 'ROAD_ACCIDENT', raw: roadAccidentRaw },
  { crimeKey: 'RAPE', raw: rapeRaw },
  { crimeKey: 'POCSO', raw: pocsoRaw },
  { crimeKey: 'KIDNAPPING', raw: kidnappingRaw },
  { crimeKey: 'ROBBERY', raw: robberyRaw },
  { crimeKey: 'CYBER', raw: cyberRaw },
  { crimeKey: 'NDPS', raw: ndpsRaw },
  { crimeKey: 'ARMS', raw: armsRaw },
  { crimeKey: 'FORGERY', raw: forgeryRaw },
  { crimeKey: 'DOWRY_DEATH', raw: dowryRaw },
  { crimeKey: 'CRUELTY', raw: crueltyRaw },
  { crimeKey: 'EXTORTION_INTIMIDATION', raw: extortionRaw },
  { crimeKey: 'BREACH_OF_TRUST', raw: breachRaw },
  { crimeKey: 'TRESPASS', raw: trespassRaw },
  { crimeKey: 'RIOTING', raw: riotingRaw },
  { crimeKey: 'culpable_homicide', raw: culpableRaw },
  { crimeKey: 'sexual_harassment', raw: harassRaw },
  { crimeKey: 'human_trafficking_unlawful_compulsory_labour', raw: traffickingRaw },
  { crimeKey: 'sc_st_act', raw: scstRaw },
  { crimeKey: 'assault_criminal_force', raw: abetmentRaw },
];

export const SHARED_FILES: Array<{ raw: string; links: Record<string, string[]> }> = [
  { raw: shared1Raw, links: shared1Links },
  { raw: shared2Raw, links: shared2Links },
];
