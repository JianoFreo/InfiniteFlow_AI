import PipelineExplainer from "../components/Upload/PipelineExplainer";
import UploadForm from "../components/Upload/UploadForm";
import type { UploadProgressInfo } from "../components/Upload/UploadForm";
import type { JobMode, PreprocessStep } from "../interface/Job";

interface UploadPageProps {
  onUpload: (
    input: { file: File; factor: number; mode: JobMode; preprocess: PreprocessStep[] },
    onProgress: (p: UploadProgressInfo) => void,
  ) => Promise<void>;
}

const UploadPage = ({ onUpload }: UploadPageProps) => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
    <UploadForm onSubmit={onUpload} />
    <PipelineExplainer />
  </div>
);

export default UploadPage;
