import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const IPManagement = () => {
  const [allowedIPs, setAllowedIPs] = useState<any[]>([]);
  const [newIPForm, setNewIPForm] = useState({ ip: '', description: '' });
  const [editingIP, setEditingIP] = useState<any>(null);

  const fetchAllowedIPs = async () => {
    const { data, error } = await supabase
      .from('allowed_ips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching allowed IPs:', error);
      toast.error("허용 IP 목록을 불러오는데 실패했습니다.");
    } else {
      setAllowedIPs(data || []);
    }
  };

  const handleAddIP = async () => {
    if (!newIPForm.ip.trim()) {
      toast.error("IP 주소를 입력해주세요.");
      return;
    }

    const { error } = await supabase
      .from('allowed_ips')
      .insert({
        ip_address: newIPForm.ip.trim(),
        description: newIPForm.description.trim() || '설명 없음'
      });

    if (error) {
      toast.error("IP 추가에 실패했습니다.");
    } else {
      setNewIPForm({ ip: '', description: '' });
      toast.success("새로운 IP가 허용 목록에 추가되었습니다.");
      fetchAllowedIPs();
    }
  };

  const handleUpdateIP = async () => {
    if (!editingIP || !editingIP.ip_address?.trim()) {
      return;
    }

    const { error } = await supabase
      .from('allowed_ips')
      .update({
        ip_address: editingIP.ip_address.trim(),
        description: editingIP.description?.trim() || '설명 없음'
      })
      .eq('id', editingIP.id);

    if (error) {
      toast.error("IP 수정에 실패했습니다.");
    } else {
      setEditingIP(null);
      toast.success("IP 정보가 수정되었습니다.");
      fetchAllowedIPs();
    }
  };

  const handleDeleteIP = async (ipId: string) => {
    const { error } = await supabase
      .from('allowed_ips')
      .delete()
      .eq('id', ipId);

    if (error) {
      toast.error("IP 삭제에 실패했습니다.");
    } else {
      toast.success("IP가 허용 목록에서 제거되었습니다.");
      fetchAllowedIPs();
    }
  };

  useEffect(() => {
    fetchAllowedIPs();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>IP 접근 관리</CardTitle>
        <CardDescription>
          데이터베이스에서 실시간으로 IP 접근을 관리합니다. 현재 210.95.187.140만 허용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* 새 IP 추가 */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-4">새 IP 추가</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newIP">IP 주소</Label>
              <Input
                id="newIP"
                placeholder="예: 210.95.187.140"
                value={newIPForm.ip}
                onChange={(e) => setNewIPForm(prev => ({ ...prev, ip: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ipDescription">설명</Label>
              <Input
                id="ipDescription"
                placeholder="IP 주소에 대한 설명"
                value={newIPForm.description}
                onChange={(e) => setNewIPForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleAddIP} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            IP 추가
          </Button>
        </div>

        {/* 허용된 IP 목록 */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-4">허용된 IP 목록</h4>
          {allowedIPs.length === 0 ? (
            <p className="text-muted-foreground">등록된 IP가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {allowedIPs.map((ipEntry) => (
                <div key={ipEntry.id} className="border rounded-lg p-3">
                  {editingIP?.id === ipEntry.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>IP 주소</Label>
                          <Input
                            value={editingIP.ip_address}
                            onChange={(e) => setEditingIP({ ...editingIP, ip_address: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>설명</Label>
                          <Input
                            value={editingIP.description}
                            onChange={(e) => setEditingIP({ ...editingIP, description: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateIP}>
                          저장
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingIP(null)}>
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm font-medium">{ipEntry.ip_address}</div>
                        <div className="text-sm text-muted-foreground">{ipEntry.description}</div>
                        <div className="text-xs text-muted-foreground">
                          상태: {ipEntry.is_active ? '활성' : '비활성'} | 
                          생성일: {new Date(ipEntry.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingIP(ipEntry)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          수정
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              삭제
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>IP 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{ipEntry.ip_address}" IP를 허용 목록에서 삭제하시겠습니까?
                                이 작업은 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteIP(ipEntry.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

export default IPManagement;