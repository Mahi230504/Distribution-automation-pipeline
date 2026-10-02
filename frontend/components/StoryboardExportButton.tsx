"use client";
import {useState} from "react";
import type {Run} from "@/lib/types";
import {fetchAsset} from "@/lib/api";
import {buildStoryboardZip,canExportStoryboard,downloadBlob} from "@/lib/export";

export default function StoryboardExportButton({run,busy=false,build=buildStoryboardZip,download=downloadBlob}:{run:Run;busy?:boolean;build?:(run:Run,fetcher:(path:string)=>Promise<Blob>)=>Promise<Blob>;download?:(blob:Blob,filename:string)=>void}){
  const[exporting,setExporting]=useState(false),[error,setError]=useState("");if(!canExportStoryboard(run))return null;
  async function exportFrames(){setError("");setExporting(true);try{download(await build(run,fetchAsset),`storyboard-frames-${run.id}.zip`);}catch(cause){setError(cause instanceof Error?cause.message:"Could not export the Storyboard frames.");}finally{setExporting(false);}}
  return <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Storyboard images</p><p className="text-sm text-muted">Download the exact selected frames as a ZIP for use in your video generator.</p>{error&&<p role="alert" className="mt-1 text-sm text-warning">{error}</p>}</div><button className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium" disabled={busy||exporting} onClick={()=>void exportFrames()}>{exporting?"Preparing ZIP…":"Download storyboard frames"}</button></section>;
}
