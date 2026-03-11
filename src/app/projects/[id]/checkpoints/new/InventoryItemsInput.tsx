"use client";

import { useState } from "react";

const HIDDEN_NAME = "inventory_items";

const UNIT_OPTIONS = ["개", "박스", "kg", "L", "g", "ml", "병", "봉지", "기타"] as const;

export type InventoryItemWithUnit = { name: string; unit: string };

function toItemsWithUnit(value: string[] | InventoryItemWithUnit[]): InventoryItemWithUnit[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    typeof item === "string"
      ? { name: item.trim(), unit: "개" }
      : { name: String(item?.name ?? "").trim(), unit: String(item?.unit ?? "개").trim() || "개" }
  ).filter((item) => item.name.length > 0);
}

type Props = {
  /** 기존 값: 문자열 배열(이전 형식) 또는 { name, unit }[] */
  defaultValue?: string[] | InventoryItemWithUnit[];
};

export default function InventoryItemsInput({ defaultValue = [] }: Props) {
  const [items, setItems] = useState<InventoryItemWithUnit[]>(() => toItemsWithUnit(defaultValue));
  const [singleName, setSingleName] = useState("");
  const [singleUnit, setSingleUnit] = useState("개");
  const [customUnit, setCustomUnit] = useState("");
  const [commaInput, setCommaInput] = useState("");

  const resolveUnit = () => (singleUnit === "기타" ? customUnit.trim() || "개" : singleUnit);

  const addOne = () => {
    const name = singleName.trim();
    if (!name) return;
    const unit = resolveUnit();
    if (items.some((i) => i.name === name && i.unit === unit)) return;
    setItems([...items, { name, unit }]);
    setSingleName("");
    setSingleUnit("개");
    setCustomUnit("");
  };

  const remove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const setUnit = (index: number, unit: string) => {
    setItems(items.map((it, i) => (i === index ? { ...it, unit } : it)));
  };

  const applyCommaInput = () => {
    const names = commaInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const newItems = names.map((name) => ({ name, unit: "개" as const }));
    const merged = [...items];
    for (const { name, unit } of newItems) {
      if (!merged.some((i) => i.name === name && i.unit === unit)) {
        merged.push({ name, unit });
      }
    }
    setItems(merged);
    setCommaInput("");
  };

  const output: InventoryItemWithUnit[] = items;

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={HIDDEN_NAME}
        value={JSON.stringify(output)}
        readOnly
      />
      <div>
        <label className="block text-xs font-medium text-slate-500">
          쉼표(,)로 한 번에 입력 (단위: 개)
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={commaInput}
            onChange={(e) => setCommaInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCommaInput())}
            placeholder="예: 생수, 바나나, 초코바"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <button
            type="button"
            onClick={applyCommaInput}
            className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            반영
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">
          항목 하나씩 추가 (이름 + 단위)
        </label>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOne())}
            placeholder="예: 생수"
            className="min-w-[100px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <select
            value={singleUnit}
            onChange={(e) => setSingleUnit(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {singleUnit === "기타" && (
            <input
              type="text"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              placeholder="단위 입력"
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            />
          )}
          <button
            type="button"
            onClick={addOne}
            className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            추가
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-500">등록된 물자</span>
          <ul className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <li
                key={`${item.name}-${item.unit}-${i}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-200 py-1 pl-3 pr-1 text-sm text-slate-800"
              >
                <span>{item.name}</span>
                <select
                  value={item.unit}
                  onChange={(e) => setUnit(i, e.target.value)}
                  className="max-w-[72px] rounded border-0 bg-slate-100 py-0.5 text-xs focus:ring-1 focus:ring-slate-500"
                >
                  {UNIT_OPTIONS.filter((u) => u !== "기타").map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  {!UNIT_OPTIONS.slice(0, -1).includes(item.unit as (typeof UNIT_OPTIONS)[number]) && (
                    <option value={item.unit}>{item.unit}</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-300 hover:text-slate-800"
                  aria-label={`${item.name} 삭제`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
