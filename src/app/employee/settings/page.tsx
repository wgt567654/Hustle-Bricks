"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/AddressAutocomplete";

export default function EmployeeSettingsPage() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [memberId, setMemberId] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("team_members")
        .select("id, home_address")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setMemberId(data.id);
        setHomeAddress(data.home_address ?? "");
      }
    }
    load();
  }, []);

  async function saveAddress() {
    if (!memberId) return;
    setSavingAddress(true);
    const supabase = createClient();
    await supabase
      .from("team_members")
      .update({ home_address: addressInput.trim() })
      .eq("id", memberId);
    setHomeAddress(addressInput.trim());
    setEditingAddress(false);
    setSavingAddress(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    const res = await fetch("/api/account/delete-employee", { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const { error } = await res.json();
      alert(error ?? "Could not delete account. Please try again.");
      setDeletingAccount(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-xl mx-auto pb-32 lg:pb-8">
      <div className="flex flex-col gap-0.5 mb-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your account.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mileage</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {editingAddress ? (
            <div className="p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">Home Address</p>
              <p className="text-xs text-muted-foreground">Used to calculate your driving distance for gas reimbursement.</p>
              <AddressAutocomplete
                value={addressInput}
                onChange={setAddressInput}
                placeholder="123 Main St, City, State 00000"
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAddress(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAddress}
                  disabled={savingAddress || !addressInput.trim()}
                  className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {savingAddress ? "Saving…" : "Save Address"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setAddressInput(homeAddress); setEditingAddress(true); }}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <span className="material-symbols-outlined text-[20px]">home_pin</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-sm text-foreground">Home Address</span>
                <span className="text-xs text-muted-foreground">
                  {homeAddress || "Not set — tap to add for gas reimbursement"}
                </span>
              </div>
              <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
            </button>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Account</h3>
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden divide-y divide-border/50">
          <button
            onClick={signOut}
            className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm text-red-500">Sign Out</span>
              <span className="text-xs text-muted-foreground">You&apos;ll need to log back in</span>
            </div>
            <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            <div className="size-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]">delete_forever</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm text-red-500">Delete Account</span>
              <span className="text-xs text-muted-foreground">Permanently remove your account and data</span>
            </div>
            <span className="material-symbols-outlined text-muted-foreground ml-auto">chevron_right</span>
          </button>
        </Card>
      </section>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div>
                <p className="font-bold text-base text-foreground">Delete Account?</p>
                <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Your account and all associated data will be permanently deleted. You will not be able to log back in.
            </p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deletingAccount}
                className="flex-[2] py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deletingAccount ? "Deleting…" : "Yes, Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
