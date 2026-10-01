import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { settings } from "./settings.js";
import type { TokenEnvelope } from "./publication-types.js";

const MAX_SECRET_BYTES=64*1024;
export type KeyRing=Map<string,Buffer>;
export function parseKeyRing(raw=settings.platformTokenKeysJson,active=settings.platformTokenActiveKeyId):KeyRing{
  if(!raw){if(settings.publishMode==="test")return new Map();throw new Error("LIVE publishing requires PLATFORM_TOKEN_KEYS_JSON.");}
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error("PLATFORM_TOKEN_KEYS_JSON must be valid JSON.");}
  if(!parsed||Array.isArray(parsed)||typeof parsed!=="object")throw new Error("PLATFORM_TOKEN_KEYS_JSON must be an object of key IDs to base64 keys.");
  const ring=new Map<string,Buffer>();for(const [id,value] of Object.entries(parsed)){if(!/^[A-Za-z0-9._-]{1,40}$/.test(id)||typeof value!=="string")throw new Error("Platform token key ring contains an invalid entry.");const key=Buffer.from(value,"base64");if(key.length!==32)throw new Error(`Platform token key ${id} must decode to exactly 32 bytes.`);ring.set(id,key);}
  if(!active||!ring.has(active))throw new Error("PLATFORM_TOKEN_ACTIVE_KEY_ID must name a configured key.");return ring;
}
export function encryptSecret(value:unknown,aad:string,ring=parseKeyRing(),keyId=settings.platformTokenActiveKeyId):TokenEnvelope{const plain=Buffer.from(JSON.stringify(value));if(plain.length>MAX_SECRET_BYTES)throw new Error("Secret payload is too large.");const key=ring.get(keyId);if(!key)throw new Error("The active platform encryption key is unavailable.");const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,nonce);cipher.setAAD(Buffer.from(aad));const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);return{version:1,keyId,nonce:nonce.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64")};}
export function decryptSecret<T>(envelope:TokenEnvelope,aad:string,ring=parseKeyRing()):T{if(envelope.version!==1||Buffer.byteLength(envelope.ciphertext,"base64")>MAX_SECRET_BYTES)throw new Error("Encrypted platform secret is invalid.");const key=ring.get(envelope.keyId);if(!key)throw new Error("The encryption key for this connection is unavailable. Reconnect the account.");try{const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.nonce,"base64"));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(Buffer.from(envelope.tag,"base64"));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,"base64")),decipher.final()]).toString("utf8")) as T;}catch{throw new Error("The saved connection secret could not be decrypted. Reconnect the account.");}}
export const connectionAad=(ownerId:string,provider:string,connectionId:string)=>`vpo:connection:${ownerId}:${provider}:${connectionId}`;
