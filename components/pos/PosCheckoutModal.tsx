"use client";

import { useState, useMemo, useEffect } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import { PAYMENT_LABELS, type PosPaymentMethod } from "@/lib/payments/labels";
import { NumericField } from "@/components/ui/NumericField";
import {
  calculateChange,
  calculateMissing,
  computeCashSuggestions,
  calculateSplitTotal,
  calculateSplitRemaining,
  isSplitPaymentValid,
  type SplitPaymentLineItem,
} from "./posCheckoutLogic";

export type SplitPaymentLine = SplitPaymentLineItem;

interface PosCheckoutModalProps {
  isOpen: boolean;
  total: number;
  initialMethod?: PosPaymentMethod;
  onClose: () => void;
  onConfirm: (data: {
    paymentMethod: PosPaymentMethod;
    amountReceived?: number;
    changeGiven?: number;
    splitPayments?: Array<{
      method: PosPaymentMethod;
      amount: number;
      amountReceived?: number;
      changeGiven?: number;
    }>;
  }) => Promise<void>;
  saving: boolean;
}

const CHECKOUT_METHODS: ReadonlyArray<{ id: PosPaymentMethod; label: string; icon: string }> = [
  { id: "espece", label: "Espèces", icon: ICONS.cash },
  { id: "wave", label: "Wave", icon: ICONS.mobileMoney },
  { id: "orange_money", label: "Orange M.", icon: ICONS.mobileMoney },
  { id: "moov_money", label: "Moov M.", icon: ICONS.mobileMoney },
  { id: "mtn_momo", label: "MTN MoMo", icon: ICONS.mobileMoney },
  { id: "mixte", label: "Mixte", icon: ICONS.mixte },
];

export function PosCheckoutModal({
  isOpen,
  total,
  initialMethod = "espece",
  onClose,
  onConfirm,
  saving,
}: PosCheckoutModalProps) {
  const [method, setMethod] = useState<PosPaymentMethod>(initialMethod);

  // Espèces : montant remis initialisé à 0 selon la demande utilisateur
  const [cashReceived, setCashReceived] = useState<string>("0");

  // Mixte : liste des règlements
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([
    { id: "split-1", method: "espece", amount: Math.floor(total / 2) },
    { id: "split-2", method: "wave", amount: total - Math.floor(total / 2) },
  ]);

  // Synchronisation lors de l'ouverture ou du changement de total/méthode initiale
  useEffect(() => {
    if (isOpen) {
      setMethod(initialMethod);
      setCashReceived("0");
      const half = Math.floor(total / 2);
      setSplitLines([
        { id: "split-1", method: "espece", amount: half },
        { id: "split-2", method: "wave", amount: total - half },
      ]);
    }
  }, [isOpen, total, initialMethod]);

  // Calculs Espèces
  const cashReceivedNum = Number(cashReceived) || 0;
  const changeToGive = calculateChange(cashReceivedNum, total);
  const cashMissing = calculateMissing(cashReceivedNum, total);

  // Suggestions de coupures FCFA calculées intelligemment
  const cashSuggestions = useMemo(() => computeCashSuggestions(total), [total]);

  // Calculs Mixte
  const splitTotalAllocated = useMemo(() => calculateSplitTotal(splitLines), [splitLines]);
  const splitRemaining = calculateSplitRemaining(total, splitTotalAllocated);
  const isSplitValid = method === "mixte" && isSplitPaymentValid(total, splitLines);

  // Manipulation des lignes fractionnées
  function updateSplitLine(id: string, patch: Partial<SplitPaymentLine>) {
    setSplitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeSplitLine(id: string) {
    if (splitLines.length <= 2) return;
    setSplitLines((prev) => prev.filter((l) => l.id !== id));
  }

  function addSplitLine() {
    if (splitLines.length >= 5) return;
    // Choisir un mode qui n'est pas encore présent si possible
    const usedMethods = new Set(splitLines.map((l) => l.method));
    const available = (["orange_money", "moov_money", "mtn_momo", "wave", "espece"] as PosPaymentMethod[]).find(
      (m) => !usedMethods.has(m)
    ) || "wave";

    const nextAmount = Math.max(0, splitRemaining);
    setSplitLines((prev) => [
      ...prev,
      { id: `split-${Date.now()}`, method: available, amount: nextAmount },
    ]);
  }

  function allocateRemainingToLine(id: string) {
    const line = splitLines.find((l) => l.id === id);
    if (!line) return;
    const currentSumWithoutThis = splitLines
      .filter((l) => l.id !== id)
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const needed = Math.max(0, total - currentSumWithoutThis);
    updateSplitLine(id, { amount: needed });
  }

  async function handleValidate() {
    if (saving) return;

    if (method === "espece") {
      if (cashReceivedNum < total) return;
      await onConfirm({
        paymentMethod: "espece",
        amountReceived: cashReceivedNum,
        changeGiven: changeToGive,
      });
    } else if (method === "mixte") {
      if (!isSplitValid) return;
      await onConfirm({
        paymentMethod: "mixte",
        splitPayments: splitLines.map((l) => ({
          method: l.method,
          amount: l.amount,
          amountReceived: l.amountReceived ?? (l.method === "espece" ? l.amount : undefined),
          changeGiven:
            l.method === "espece" && l.amountReceived
              ? Math.max(0, l.amountReceived - l.amount)
              : 0,
        })),
      });
    } else {
      // Mobile money direct (Wave, Orange, Moov, MTN)
      await onConfirm({
        paymentMethod: method,
        amountReceived: total,
        changeGiven: 0,
      });
    }
  }

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,27,24,.55)",
        backdropFilter: "blur(2px)",
        zIndex: 65,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "100%",
          maxHeight: "92vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 20px 48px rgba(30,27,24,.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "ft-fade .18s ease-out",
        }}
      >
        {/* En-tête */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FAF8F5",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", color: colors.muted }}>
              ENCAISSEMENT VENTE
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 26,
                color: colors.primary,
                marginTop: 2,
              }}
            >
              {money(total)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1.5px solid ${colors.borderField}`,
              background: "#fff",
              color: colors.muted,
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Sélecteur de méthode */}
        <div style={{ padding: "14px 20px 10px", borderBottom: `1px solid ${colors.faintLine}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 8 }}>
            Mode de règlement
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {CHECKOUT_METHODS.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  style={{
                    height: 44,
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    font: `600 12px ${fonts.ui}`,
                    border: `1.5px solid ${active ? colors.primary : colors.borderField}`,
                    background: active ? "#EEF0F7" : "#fff",
                    color: active ? colors.primary : colors.ink,
                    transition: "all .12s ease",
                  }}
                >
                  <Icon path={m.icon} size={16} stroke={active ? colors.primary : colors.muted} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Corps modal défilable */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {/* VUE 1 : ESPÈCES */}
          {method === "espece" && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.ink, marginBottom: 6 }}>
                  Montant remis par la cliente
                </label>
                <NumericField
                  mode="money"
                  value={cashReceived}
                  onChange={setCashReceived}
                  placeholder="0 FCFA"
                />
              </div>

              {/* Raccourcis de billets / coupures */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 6 }}>
                  Raccourcis rapides
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(total))}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${cashReceivedNum === total ? colors.primary : colors.borderField}`,
                      background: cashReceivedNum === total ? "#EEF0F7" : "#fff",
                      color: cashReceivedNum === total ? colors.primary : colors.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Montant exact ({money(total)})
                  </button>
                  {cashSuggestions.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashReceived(String(amt))}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1.5px solid ${cashReceivedNum === amt ? colors.primary : colors.borderField}`,
                        background: cashReceivedNum === amt ? "#EEF0F7" : "#fff",
                        color: cashReceivedNum === amt ? colors.primary : colors.ink,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {money(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(cashReceivedNum + 1000))}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1.5px solid ${colors.borderField}`,
                      background: "#FAF8F5",
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    +1 000
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(cashReceivedNum + 5000))}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1.5px solid ${colors.borderField}`,
                      background: "#FAF8F5",
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    +5 000
                  </button>
                </div>
              </div>

              {/* Encadré dynamique de rendu de monnaie */}
              {cashReceivedNum >= total ? (
                <div
                  style={{
                    background: changeToGive > 0 ? "#EAF7ED" : "#FAF8F5",
                    border: `1.5px solid ${changeToGive > 0 ? colors.fgSuccess : colors.borderSoft}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: changeToGive > 0 ? colors.fgSuccess : colors.muted }}>
                      {changeToGive > 0 ? "MONNAIE À RENDRE" : "COMPTE EXACT"}
                    </div>
                    <div
                      style={{
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontSize: 24,
                        color: changeToGive > 0 ? colors.fgSuccess : colors.ink,
                        marginTop: 2,
                      }}
                    >
                      {money(changeToGive)}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: changeToGive > 0 ? colors.fgSuccess : "#EEF0F7",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon path={ICONS.cash} size={22} stroke={changeToGive > 0 ? "#fff" : colors.primary} />
                  </div>
                </div>
              ) : cashReceivedNum === 0 ? (
                <div
                  style={{
                    background: "#FAF8F5",
                    border: `1.5px dashed ${colors.borderField}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.muted }}>SAISIE DES ESPÈCES</div>
                    <div style={{ fontSize: 13, marginTop: 2, color: colors.ink }}>
                      Saisissez le montant remis ou touchez <strong>Montant exact</strong>.
                    </div>
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: "#EEF0F7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon path={ICONS.cash} size={20} stroke={colors.primary} />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: colors.bgWarning,
                    border: `1.5px solid ${colors.accent}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: colors.fgWarning,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>MONTANT INSUFFISANT</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>Il manque {money(cashMissing)} pour couvrir la vente.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VUE 2 : PAIEMENT MIXTE / MULTIPLE */}
          {method === "mixte" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.ink }}>
                  Ventilation par moyen de paiement
                </span>
                {splitLines.length < 5 && (
                  <button
                    type="button"
                    onClick={addSplitLine}
                    style={{
                      background: "none",
                      border: "none",
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 6px",
                    }}
                  >
                    + Ajouter un moyen
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {splitLines.map((line, idx) => {
                  return (
                    <div
                      key={line.id}
                      style={{
                        border: `1.5px solid ${colors.borderSoft}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              background: "#FAF8F5",
                              color: colors.muted,
                              fontSize: 11,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <select
                            value={line.method}
                            onChange={(e) =>
                              updateSplitLine(line.id, { method: e.target.value as PosPaymentMethod })
                            }
                            style={{
                              border: `1px solid ${colors.borderField}`,
                              borderRadius: 8,
                              padding: "4px 8px",
                              font: `600 12.5px ${fonts.ui}`,
                              color: colors.ink,
                              background: "#fff",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            {CHECKOUT_METHODS.filter((m) => m.id !== "mixte").map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {splitLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeSplitLine(line.id)}
                            style={{
                              border: "none",
                              background: "none",
                              color: colors.fgDanger,
                              fontSize: 16,
                              cursor: "pointer",
                              padding: "2px 6px",
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <NumericField
                            mode="money"
                            value={String(line.amount || 0)}
                            onChange={(val) => updateSplitLine(line.id, { amount: Number(val) || 0 })}
                            placeholder="0"
                          />
                        </div>
                        {splitRemaining !== 0 && (
                          <button
                            type="button"
                            onClick={() => allocateRemainingToLine(line.id)}
                            title="Ajuster ce mode avec le solde restant"
                            style={{
                              height: 44,
                              padding: "0 10px",
                              borderRadius: 10,
                              border: `1.5px solid ${colors.primary}`,
                              background: "#EEF0F7",
                              color: colors.primary,
                              font: `600 11.5px ${fonts.ui}`,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flex: "none",
                            }}
                          >
                            Allouer solde
                          </button>
                        )}
                      </div>

                      {/* Sous-section facultative pour la part espèces : montant remis & rendu */}
                      {line.method === "espece" && line.amount > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: `1px dashed ${colors.faintLine}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: colors.muted }}>Espèces reçues :</span>
                          <div style={{ width: 130 }}>
                            <NumericField
                              mode="money"
                              value={String(line.amountReceived ?? line.amount)}
                              onChange={(v) => updateSplitLine(line.id, { amountReceived: Number(v) || line.amount })}
                              placeholder={String(line.amount)}
                            />
                          </div>
                          {(line.amountReceived ?? line.amount) > line.amount && (
                            <span style={{ color: colors.fgSuccess, fontWeight: 700 }}>
                              Rendu : {money((line.amountReceived ?? line.amount) - line.amount)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Jauge d'équilibre / Répartition */}
              <div
                style={{
                  background: isSplitValid ? "#EAF7ED" : "#FFF7ED",
                  border: `1.5px solid ${isSplitValid ? colors.fgSuccess : colors.accent}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: 4 }}>
                  <span>Total alloué :</span>
                  <span>
                    {money(splitTotalAllocated)} / {money(total)}
                  </span>
                </div>
                {splitRemaining === 0 ? (
                  <div style={{ color: colors.fgSuccess, fontWeight: 700, fontSize: 12.5 }}>
                    ✓ Le montant total est intégralement couvert.
                  </div>
                ) : splitRemaining > 0 ? (
                  <div style={{ color: colors.fgWarning, fontWeight: 600, fontSize: 12.5 }}>
                    Reste à répartir : <strong>{money(splitRemaining)}</strong>
                  </div>
                ) : (
                  <div style={{ color: colors.danger, fontWeight: 600, fontSize: 12.5 }}>
                    Dépassement de <strong>{money(Math.abs(splitRemaining))}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VUE 3 : MOBILE MONEY UNIQUE (Wave, Orange, Moov, MTN) */}
          {method !== "espece" && method !== "mixte" && (
            <div style={{ textAlign: "center", padding: "16px 8px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#EEF0F7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Icon path={ICONS.mobileMoney} size={28} stroke={colors.primary} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.ink }}>
                Paiement direct {PAYMENT_LABELS[method]}
              </div>
              <div style={{ fontSize: 13, color: colors.muted, margin: "6px 0 16px" }}>
                Demandez à la cliente de transférer exactement <strong>{money(total)}</strong> sur votre compte marchand.
              </div>
              <button
                type="button"
                onClick={() => setMethod("mixte")}
                style={{
                  background: "none",
                  border: `1.5px solid ${colors.borderField}`,
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: colors.primary,
                  cursor: "pointer",
                }}
              >
                ⇄ Fractionner avec un autre moyen (Mixte)
              </button>
            </div>
          )}
        </div>

        {/* Bouton d'action principal */}
        <div style={{ padding: "14px 20px 18px", borderTop: `1px solid ${colors.borderSoft}`, background: "#FAF8F5" }}>
          <button
            type="button"
            onClick={handleValidate}
            disabled={
              saving ||
              (method === "espece" && cashReceivedNum < total) ||
              (method === "mixte" && !isSplitValid)
            }
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              border: "none",
              background:
                saving ||
                (method === "espece" && cashReceivedNum < total) ||
                (method === "mixte" && !isSplitValid)
                  ? colors.disabled
                  : colors.primary,
              color: "#fff",
              font: `700 16px ${fonts.ui}`,
              cursor:
                saving ||
                (method === "espece" && cashReceivedNum < total) ||
                (method === "mixte" && !isSplitValid)
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(38,50,107,.24)",
            }}
          >
            {saving ? (
              "Validation de la vente…"
            ) : method === "espece" && cashReceivedNum === 0 ? (
              <span>Saisir le montant remis ({money(total)})</span>
            ) : method === "espece" && changeToGive > 0 ? (
              <>
                <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />
                <span>Encaisser · Rendre {money(changeToGive)}</span>
              </>
            ) : method === "mixte" ? (
              <>
                <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />
                <span>Valider encaissement mixte ({money(total)})</span>
              </>
            ) : (
              <>
                <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />
                <span>Valider l&apos;encaissement · {money(total)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
