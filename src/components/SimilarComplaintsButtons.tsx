import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Building, CheckCircle } from "lucide-react";

interface SimilarComplaint {
  id: string;
  summary: string;
  content: string;
  serialNumber: string;
  department: string;
  status: string;
  date: string;
  similarity: number;
}

interface SimilarComplaintsButtonsProps {
  complaints: SimilarComplaint[];
}

export const SimilarComplaintsButtons = ({ complaints }: SimilarComplaintsButtonsProps) => {
  const [selectedComplaint, setSelectedComplaint] = useState<SimilarComplaint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleComplaintClick = (complaint: SimilarComplaint) => {
    setSelectedComplaint(complaint);
    setIsDialogOpen(true);
  };

  if (!complaints || complaints.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2 mt-4">
        <div className="text-sm font-medium text-muted-foreground mb-2">
          📋 유사민원사례 ({complaints.length}건)
        </div>
        {complaints.map((complaint, index) => (
          <Button
            key={complaint.id}
            variant="outline"
            className="w-full text-left p-3 h-auto flex flex-col items-start space-y-1 hover:bg-accent/50 transition-colors"
            onClick={() => handleComplaintClick(complaint)}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-sm">
                🔍 유사민원 {index + 1}
              </span>
              <Badge variant="secondary" className="text-xs">
                {complaint.similarity.toFixed(0)}% 유사
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground text-left line-clamp-2">
              {complaint.summary}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building className="w-3 h-3" />
              {complaint.department}
              <Calendar className="w-3 h-3 ml-1" />
              {complaint.date}
            </div>
          </Button>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              유사민원 상세내용
            </DialogTitle>
            <DialogDescription>
              선택하신 유사민원의 상세 정보입니다.
            </DialogDescription>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium">민원번호:</span>
                    <span>{selectedComplaint.serialNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4" />
                    <span className="font-medium">처리부서:</span>
                    <span>{selectedComplaint.department}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">처리상태:</span>
                    <Badge variant={selectedComplaint.status === '처리완료' ? 'default' : 'secondary'}>
                      {selectedComplaint.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">처리날짜:</span>
                    <span>{selectedComplaint.date}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">유사도:</span>
                  <Badge variant="outline" className="text-primary">
                    {selectedComplaint.similarity.toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  민원 내용
                </h4>
                <div className="p-4 bg-background border rounded-lg">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedComplaint.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};