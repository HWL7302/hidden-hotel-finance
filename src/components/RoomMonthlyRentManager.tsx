"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DateInput, MonthInput } from "@/components/DateInputs";
import { createClient } from "@/lib/supabase-client";
import { logAuditEvent } from "@/lib/audit-client";
import type { AppRole } from "@/lib/permissions";

type RoomStatus =
  | "vacant"
  | "monthly_rented"
  | "short_term"
  | "maintenance"
  | "inactive";

type RentStatus = "active" | "ended" | "paused" | "overdue";

type RoomRecord = {
  id: string;
  store_id: string;
  room_number: string;
  room_type: string | null;
  management_status: RoomStatus;
  notes: string | null;
  created_at: string;
};

type MonthlyRentRecord = {
  id: string;
  store_id: string;
  room_id: string;
  tenant_name: string;
  tenant_contact: string | null;
  monthly_rent: string | number;
  deposit: string | number;
  start_date: string;
  end_date: string | null;
  status: RentStatus;
  notes: string | null;
  created_at: string;
};

type RoomFormState = {
  roomNumber: string;
  roomType: string;
  status: RoomStatus;
  notes: string;
};

type RentFormState = {
  roomId: string;
  tenantName: string;
  tenantContact: string;
  monthlyRent: string;
  deposit: string;
  startDate: string;
  endDate: string;
  status: RentStatus;
  notes: string;
};

const roomStatusOptions: { value: RoomStatus; label: string }[] = [
  { value: "vacant", label: "空置" },
  { value: "monthly_rented", label: "月租中" },
  { value: "short_term", label: "短租中" },
  { value: "maintenance", label: "维修中" },
  { value: "inactive", label: "停用" }
];

const rentStatusOptions: { value: RentStatus; label: string }[] = [
  { value: "active", label: "进行中" },
  { value: "ended", label: "已结束" },
  { value: "paused", label: "暂停" },
  { value: "overdue", label: "欠费" }
];

const emptyRoomForm: RoomFormState = {
  roomNumber: "",
  roomType: "",
  status: "vacant",
  notes: ""
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function emptyRentForm(): RentFormState {
  return {
    roomId: "",
    tenantName: "",
    tenantContact: "",
    monthlyRent: "",
    deposit: "",
    startDate: todayValue(),
    endDate: "",
    status: "active",
    notes: ""
  };
}

function getMonthRange(month: string) {
  const start = `${month}-01`;
  const nextMonth = new Date(`${start}T00:00:00`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    start,
    end: nextMonth.toISOString().slice(0, 10)
  };
}

function parseAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined) {
  return Math.round(parseAmount(value)).toLocaleString("zh-CN");
}

function isValidAmount(value: string) {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

function getRoomStatusLabel(status: string | null | undefined) {
  return roomStatusOptions.find((option) => option.value === status)?.label ?? "-";
}

function getRentStatusLabel(status: string | null | undefined) {
  return rentStatusOptions.find((option) => option.value === status)?.label ?? "-";
}

function isRentActiveInMonth(record: MonthlyRentRecord, month: string) {
  const range = getMonthRange(month);
  return (
    record.status === "active" &&
    record.start_date < range.end &&
    (!record.end_date || record.end_date >= range.start)
  );
}

export function RoomMonthlyRentManager({
  currentUserId,
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentUserId: string;
  currentRole: AppRole;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const canManage = currentRole === "admin" || currentRole === "operator";
  const canDelete = currentRole === "admin";
  const showActionColumn = canManage || canDelete;
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [rentRecords, setRentRecords] = useState<MonthlyRentRecord[]>([]);
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm);
  const [rentForm, setRentForm] = useState<RentFormState>(emptyRentForm);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRentId, setEditingRentId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomStatusFilter, setRoomStatusFilter] = useState<"all" | RoomStatus>(
    "all"
  );
  const [rentStatusFilter, setRentStatusFilter] = useState<"all" | RentStatus>(
    "all"
  );
  const [month, setMonth] = useState(currentMonthValue);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isSavingRent, setIsSavingRent] = useState(false);

  async function loadData() {
    if (!defaultStoreId) {
      setError(
        storeLoadError ||
          "无法读取房间/月租数据：当前用户没有绑定 store_id。"
      );
      return;
    }

    setError("");
    setNotice("");
    setIsLoading(true);

    const range = getMonthRange(month);
    const [roomResult, rentResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id,store_id,room_number,room_type,management_status,notes,created_at")
        .eq("store_id", defaultStoreId)
        .order("room_number", { ascending: true }),
      supabase
        .from("monthly_rent_records")
        .select(
          "id,store_id,room_id,tenant_name,tenant_contact,monthly_rent,deposit,start_date,end_date,status,notes,created_at"
        )
        .eq("store_id", defaultStoreId)
        .lt("start_date", range.end)
        .or(`end_date.is.null,end_date.gte.${range.start}`)
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false })
    ]);

    setIsLoading(false);

    if (roomResult.error) {
      setError(roomResult.error.message);
      return;
    }

    if (rentResult.error) {
      setError(rentResult.error.message);
      return;
    }

    const loadedRooms = (roomResult.data ?? []) as RoomRecord[];
    const loadedRentRecords = (rentResult.data ?? []) as MonthlyRentRecord[];
    setRooms(loadedRooms);
    setRentRecords(loadedRentRecords);
    setSelectedRoomId((current) => current ?? loadedRooms[0]?.id ?? null);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId, month]);

  const activeRentRecords = rentRecords.filter((record) =>
    isRentActiveInMonth(record, month)
  );

  const activeRentByRoom = useMemo(() => {
    const map = new Map<string, MonthlyRentRecord>();

    for (const record of activeRentRecords) {
      if (!map.has(record.room_id)) {
        map.set(record.room_id, record);
      }
    }

    return map;
  }, [activeRentRecords]);

  const filteredRooms = rooms.filter((room) =>
    roomStatusFilter === "all"
      ? true
      : room.management_status === roomStatusFilter
  );

  const filteredRentRecords = rentRecords.filter((record) =>
    rentStatusFilter === "all" ? true : record.status === rentStatusFilter
  );

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedRoomCurrentRent = selectedRoomId
    ? activeRentByRoom.get(selectedRoomId) ?? null
    : null;

  const monthlyRentReceivable = activeRentRecords.reduce(
    (sum, record) => sum + parseAmount(record.monthly_rent),
    0
  );
  const statsRange = getMonthRange(month);
  const monthlyDepositAmount = rentRecords.reduce((sum, record) => {
    if (record.start_date >= statsRange.start && record.start_date < statsRange.end) {
      return sum + parseAmount(record.deposit);
    }

    return sum;
  }, 0);

  const stats = [
    { label: "房间总数", value: String(rooms.length) },
    { label: "当前月租房间数", value: String(activeRentRecords.length) },
    {
      label: "空置房间数",
      value: String(
        rooms.filter((room) => room.management_status === "vacant").length
      )
    },
    {
      label: "本月月租应收金额",
      value: `${formatMoney(monthlyRentReceivable)} RMB`
    },
    {
      label: "本月押金收取金额",
      value: `${formatMoney(monthlyDepositAmount)} RMB`
    },
    {
      label: "本月合计收款金额",
      value: `${formatMoney(monthlyRentReceivable + monthlyDepositAmount)} RMB`
    }
  ];

  function resetRoomForm() {
    setEditingRoomId(null);
    setRoomForm(emptyRoomForm);
  }

  function resetRentForm() {
    setEditingRentId(null);
    setRentForm(emptyRentForm());
  }

  function startEditRoom(room: RoomRecord) {
    if (!canManage) {
      setError("当前角色只能查看房间信息，不能编辑。");
      return;
    }

    setEditingRoomId(room.id);
    setRoomForm({
      roomNumber: room.room_number,
      roomType: room.room_type ?? "",
      status: room.management_status,
      notes: room.notes ?? ""
    });
    setError("");
    setNotice("");
  }

  function startEditRent(record: MonthlyRentRecord) {
    if (!canManage) {
      setError("当前角色只能查看月租记录，不能编辑。");
      return;
    }

    setEditingRentId(record.id);
    setRentForm({
      roomId: record.room_id,
      tenantName: record.tenant_name,
      tenantContact: record.tenant_contact ?? "",
      monthlyRent: String(record.monthly_rent ?? ""),
      deposit: String(record.deposit ?? ""),
      startDate: record.start_date,
      endDate: record.end_date ?? "",
      status: record.status,
      notes: record.notes ?? ""
    });
    setSelectedRoomId(record.room_id);
    setError("");
    setNotice("");
  }

  async function handleRoomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!canManage) {
      setError("当前角色没有新增或编辑房间的权限。");
      return;
    }

    if (!defaultStoreId) {
      setError("无法保存房间：当前用户没有绑定 store_id。");
      return;
    }

    if (!roomForm.roomNumber.trim()) {
      setError("请填写房间号。");
      return;
    }

    setIsSavingRoom(true);

    const payload = {
      store_id: defaultStoreId,
      room_number: roomForm.roomNumber.trim(),
      room_type: roomForm.roomType.trim() || null,
      management_status: roomForm.status,
      notes: roomForm.notes.trim() || null,
      customer_name_or_code: "-",
      customer_type: "monthly_rent",
      monthly_rent: 0,
      check_in_date: todayValue(),
      payment_received: 0,
      status: "active",
      created_by: currentUserId
    };

    const result = editingRoomId
      ? await supabase
          .from("rooms")
          .update({
            room_number: payload.room_number,
            room_type: payload.room_type,
            management_status: payload.management_status,
            notes: payload.notes,
            note: payload.notes
          })
          .eq("id", editingRoomId)
      : await supabase.from("rooms").insert({
          ...payload,
          note: payload.notes
        });

    setIsSavingRoom(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setNotice(editingRoomId ? "房间信息已更新。" : "房间已新增。");
    await logAuditEvent({
      supabase,
      storeId: defaultStoreId,
      userRole: currentRole,
      action: editingRoomId ? "update" : "create",
      targetType: "room",
      targetId: editingRoomId,
      targetName: payload.room_number,
      details: {
        room_number: payload.room_number,
        management_status: payload.management_status
      }
    });

    resetRoomForm();
    await loadData();
  }

  async function handleDeleteRoom(room: RoomRecord) {
    if (!canDelete) {
      setError("当前角色没有删除房间的权限。");
      return;
    }

    if (!window.confirm(`确认删除房间 ${room.room_number} 吗？`)) {
      return;
    }

    setError("");
    setNotice("");
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", room.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("房间已删除。");
    await loadData();
  }

  async function handleRentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!canManage) {
      setError("当前角色没有新增或编辑月租记录的权限。");
      return;
    }

    if (!defaultStoreId) {
      setError("无法保存月租记录：当前用户没有绑定 store_id。");
      return;
    }

    if (!rentForm.roomId) {
      setError("请选择房间。");
      return;
    }

    if (!rentForm.tenantName.trim()) {
      setError("请填写租客姓名。");
      return;
    }

    if (
      !isValidAmount(rentForm.monthlyRent) ||
      !isValidAmount(rentForm.deposit || "0")
    ) {
      setError("金额格式不正确，请输入最多两位小数的非负金额。");
      return;
    }

    setIsSavingRent(true);

    const payload = {
      store_id: defaultStoreId,
      room_id: rentForm.roomId,
      tenant_name: rentForm.tenantName.trim(),
      tenant_contact: rentForm.tenantContact.trim() || null,
      monthly_rent: rentForm.monthlyRent,
      deposit: rentForm.deposit || "0",
      start_date: rentForm.startDate,
      end_date: rentForm.endDate || null,
      status: rentForm.status,
      notes: rentForm.notes.trim() || null,
      created_by: currentUserId
    };

    const result = editingRentId
      ? await supabase
          .from("monthly_rent_records")
          .update({
            room_id: payload.room_id,
            tenant_name: payload.tenant_name,
            tenant_contact: payload.tenant_contact,
            monthly_rent: payload.monthly_rent,
            deposit: payload.deposit,
            start_date: payload.start_date,
            end_date: payload.end_date,
            status: payload.status,
            notes: payload.notes
          })
          .eq("id", editingRentId)
      : await supabase.from("monthly_rent_records").insert(payload);

    setIsSavingRent(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setNotice(editingRentId ? "月租记录已更新。" : "月租记录已新增。");
    if (payload.status === "active") {
      const { error: roomStatusError } = await supabase
        .from("rooms")
        .update({ management_status: "monthly_rented" })
        .eq("id", payload.room_id)
        .eq("store_id", defaultStoreId);

      if (roomStatusError) {
        setError(roomStatusError.message);
        return;
      }
    }

    await logAuditEvent({
      supabase,
      storeId: defaultStoreId,
      userRole: currentRole,
      action: editingRentId ? "update" : "create",
      targetType: "monthly_rent",
      targetId: editingRentId,
      targetName: payload.tenant_name,
      details: {
        room_id: payload.room_id,
        status: payload.status,
        monthly_rent: payload.monthly_rent,
        deposit: payload.deposit
      }
    });

    setSelectedRoomId(rentForm.roomId);
    resetRentForm();
    await loadData();
  }

  async function handleDeleteRent(record: MonthlyRentRecord) {
    if (!canDelete) {
      setError("当前角色没有删除月租记录的权限。");
      return;
    }

    if (!window.confirm(`确认删除 ${record.tenant_name} 的月租记录吗？`)) {
      return;
    }

    setError("");
    setNotice("");
    const { error: deleteError } = await supabase
      .from("monthly_rent_records")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("月租记录已删除。");
    await loadData();
  }

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-2xl font-bold text-ink">房间/月租</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="whitespace-nowrap text-sm font-medium text-ink">
            显示月份：
          </span>
          <MonthInput
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {false ? (
        <p className="mt-5 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-stone-600">
          当前角色为只读模式，可以查看房间和月租台账，不能新增、编辑或删除。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm font-medium text-stone-600">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-ink">
              {isLoading ? "读取中..." : card.value}
            </p>
          </div>
        ))}
      </div>

      {canManage && selectedRoom ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h3 className="text-lg font-semibold text-ink">当前选中房间</h3>
          <div className="mt-3 grid gap-3 text-sm text-stone-700 md:grid-cols-4">
            <p>
              <span className="font-medium text-ink">房间号：</span>
              {selectedRoom.room_number}
            </p>
            <p>
              <span className="font-medium text-ink">状态：</span>
              {getRoomStatusLabel(selectedRoom.management_status)}
            </p>
            <p>
              <span className="font-medium text-ink">当前租客：</span>
              {selectedRoomCurrentRent?.tenant_name ?? "-"}
            </p>
            <p>
              <span className="font-medium text-ink">月租金额：</span>
              {selectedRoomCurrentRent
                ? formatMoney(selectedRoomCurrentRent.monthly_rent)
                : "-"}
            </p>
          </div>
        </div>
      ) : null}

      {!canManage ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-ink">房间列表</h3>
              <select
                value={roomStatusFilter}
                onChange={(event) =>
                  setRoomStatusFilter(event.target.value as "all" | RoomStatus)
                }
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
              >
                <option value="all">全部状态</option>
                {roomStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-stone-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <CompactHead>房间号</CompactHead>
                    <CompactHead>房型</CompactHead>
                    <CompactHead>状态</CompactHead>
                    <CompactHead>当前租客</CompactHead>
                    <CompactHead>月租金额</CompactHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={5}>
                        正在读取房间数据...
                      </td>
                    </tr>
                  ) : filteredRooms.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={5}>
                        当前没有符合条件的房间记录。
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => {
                      const currentRent = activeRentByRoom.get(room.id);

                      return (
                        <tr key={room.id} className="align-top">
                          <CompactCell>{room.room_number}</CompactCell>
                          <CompactCell>{room.room_type || "-"}</CompactCell>
                          <CompactCell>
                            {getRoomStatusLabel(room.management_status)}
                          </CompactCell>
                          <CompactCell>{currentRent?.tenant_name ?? "-"}</CompactCell>
                          <CompactCell>
                            {currentRent
                              ? formatMoney(currentRent.monthly_rent)
                              : "-"}
                          </CompactCell>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-ink">月租记录</h3>
              <select
                value={rentStatusFilter}
                onChange={(event) =>
                  setRentStatusFilter(event.target.value as "all" | RentStatus)
                }
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
              >
                <option value="all">全部状态</option>
                {rentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-stone-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <CompactHead>房间号</CompactHead>
                    <CompactHead>租客姓名</CompactHead>
                    <CompactHead>月租金额</CompactHead>
                    <CompactHead>开始日期</CompactHead>
                    <CompactHead>结束日期</CompactHead>
                    <CompactHead>状态</CompactHead>
                    <CompactHead>押金</CompactHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={7}>
                        正在读取月租记录...
                      </td>
                    </tr>
                  ) : filteredRentRecords.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={7}>
                        当前月份暂无符合条件的月租记录。
                      </td>
                    </tr>
                  ) : (
                    filteredRentRecords.map((record) => {
                      const room = rooms.find((item) => item.id === record.room_id);

                      return (
                        <tr key={record.id} className="align-top">
                          <CompactCell>{room?.room_number ?? "-"}</CompactCell>
                          <CompactCell>{record.tenant_name}</CompactCell>
                          <CompactCell>{formatMoney(record.monthly_rent)}</CompactCell>
                          <CompactCell>{record.start_date}</CompactCell>
                          <CompactCell>{record.end_date ?? "-"}</CompactCell>
                          <CompactCell>{getRentStatusLabel(record.status)}</CompactCell>
                          <CompactCell>{formatMoney(record.deposit)}</CompactCell>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <>
      <div
        className={`mt-6 grid gap-6 ${
          canManage ? "xl:grid-cols-[420px_1fr]" : "grid-cols-1"
        }`}
      >
        {canManage ? (
          <form
            onSubmit={handleRoomSubmit}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-ink">
                {editingRoomId ? "编辑房间" : "新增房间"}
              </h3>
              {editingRoomId ? (
                <button
                  type="button"
                  onClick={resetRoomForm}
                  className="text-sm font-medium text-stone-500 hover:text-ink"
                >
                  取消编辑
                </button>
              ) : null}
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-ink">
                房间号
                <input
                  required
                  value={roomForm.roomNumber}
                  onChange={(event) =>
                    setRoomForm((current) => ({
                      ...current,
                      roomNumber: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                房型
                <input
                  value={roomForm.roomType}
                  onChange={(event) =>
                    setRoomForm((current) => ({
                      ...current,
                      roomType: event.target.value
                    }))
                  }
                  placeholder="例如：大床房、双机房"
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                状态
                <select
                  value={roomForm.status}
                  onChange={(event) =>
                    setRoomForm((current) => ({
                      ...current,
                      status: event.target.value as RoomStatus
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                >
                  {roomStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                备注
                <textarea
                  value={roomForm.notes}
                  onChange={(event) =>
                    setRoomForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSavingRoom}
              className="mt-5 rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingRoom
                ? "保存中..."
                : editingRoomId
                  ? "保存房间"
                  : "新增房间"}
            </button>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink">房间列表</h3>
            <select
              value={roomStatusFilter}
              onChange={(event) =>
                setRoomStatusFilter(event.target.value as "all" | RoomStatus)
              }
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
            >
              <option value="all">全部状态</option>
              {roomStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <TableHead>房间号</TableHead>
                  <TableHead>房型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>当前租客</TableHead>
                  <TableHead>月租金额</TableHead>
                  <TableHead>入住开始日</TableHead>
                  <TableHead>预计结束日</TableHead>
                  <TableHead>备注</TableHead>
                  {showActionColumn ? <TableHead>操作</TableHead> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-stone-500"
                      colSpan={showActionColumn ? 9 : 8}
                    >
                      正在读取房间数据...
                    </td>
                  </tr>
                ) : filteredRooms.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-stone-500"
                      colSpan={showActionColumn ? 9 : 8}
                    >
                      当前没有符合条件的房间记录。
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => {
                    const currentRent = activeRentByRoom.get(room.id);

                    return (
                      <tr
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`cursor-pointer align-top transition-colors ${
                          selectedRoomId === room.id ? "bg-pine/10" : ""
                        }`}
                      >
                        <TableCell>{room.room_number}</TableCell>
                        <TableCell>{room.room_type || "-"}</TableCell>
                        <TableCell>
                          {getRoomStatusLabel(room.management_status)}
                        </TableCell>
                        <TableCell>{currentRent?.tenant_name ?? "-"}</TableCell>
                        <TableCell>
                          {currentRent ? formatMoney(currentRent.monthly_rent) : "-"}
                        </TableCell>
                        <TableCell>{currentRent?.start_date ?? "-"}</TableCell>
                        <TableCell>{currentRent?.end_date ?? "-"}</TableCell>
                        <td className="max-w-64 px-4 py-3 text-stone-700">
                          <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words pr-2">
                            {room.notes || "-"}
                          </div>
                        </td>
                        {showActionColumn ? (
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex gap-2">
                              {canManage ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startEditRoom(room);
                                  }}
                                  className="font-medium text-pine hover:underline"
                                >
                                  编辑
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeleteRoom(room);
                                  }}
                                  className="font-medium text-red-700 hover:underline"
                                >
                                  删除
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        className={`mt-6 grid gap-6 ${
          canManage ? "xl:grid-cols-[420px_1fr]" : "grid-cols-1"
        }`}
      >
        {canManage ? (
          <form
            onSubmit={handleRentSubmit}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-ink">
                {editingRentId ? "编辑月租记录" : "新增月租记录"}
              </h3>
              {editingRentId ? (
                <button
                  type="button"
                  onClick={resetRentForm}
                  className="text-sm font-medium text-stone-500 hover:text-ink"
                >
                  取消编辑
                </button>
              ) : null}
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-ink">
                房间号
                <select
                  required
                  value={rentForm.roomId}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      roomId: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                >
                  <option value="">请选择房间</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                租客姓名
                <input
                  required
                  value={rentForm.tenantName}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      tenantName: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                联系方式
                <input
                  value={rentForm.tenantContact}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      tenantContact: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                月租金额
                <input
                  required
                  inputMode="decimal"
                  value={rentForm.monthlyRent}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      monthlyRent: event.target.value
                    }))
                  }
                  placeholder="0"
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                押金
                <input
                  inputMode="decimal"
                  value={rentForm.deposit}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      deposit: event.target.value
                    }))
                  }
                  placeholder="0"
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                开始日期
                <DateInput
                  required
                  value={rentForm.startDate}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      startDate: event.target.value
                    }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                结束日期
                <DateInput
                  value={rentForm.endDate}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      endDate: event.target.value
                    }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                状态
                <select
                  value={rentForm.status}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      status: event.target.value as RentStatus
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                >
                  {rentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                备注
                <textarea
                  value={rentForm.notes}
                  onChange={(event) =>
                    setRentForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSavingRent}
              className="mt-5 rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingRent
                ? "保存中..."
                : editingRentId
                  ? "保存月租记录"
                  : "新增月租记录"}
            </button>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink">月租记录</h3>
            <select
              value={rentStatusFilter}
              onChange={(event) =>
                setRentStatusFilter(event.target.value as "all" | RentStatus)
              }
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-pine"
            >
              <option value="all">全部状态</option>
              {rentStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <TableHead>房间号</TableHead>
                  <TableHead>租客姓名</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>月租金额</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>押金</TableHead>
                  <TableHead>备注</TableHead>
                  {showActionColumn ? <TableHead>操作</TableHead> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-stone-500"
                      colSpan={showActionColumn ? 10 : 9}
                    >
                      正在读取月租记录...
                    </td>
                  </tr>
                ) : filteredRentRecords.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-stone-500"
                      colSpan={showActionColumn ? 10 : 9}
                    >
                      当前月份暂无符合条件的月租记录。
                    </td>
                  </tr>
                ) : (
                  filteredRentRecords.map((record) => {
                    const room = rooms.find((item) => item.id === record.room_id);

                    return (
                      <tr key={record.id} className="align-top">
                        <TableCell>{room?.room_number ?? "-"}</TableCell>
                        <TableCell>{record.tenant_name}</TableCell>
                        <TableCell>{record.tenant_contact || "-"}</TableCell>
                        <TableCell>{formatMoney(record.monthly_rent)}</TableCell>
                        <TableCell>{record.start_date}</TableCell>
                        <TableCell>{record.end_date ?? "-"}</TableCell>
                        <TableCell>{getRentStatusLabel(record.status)}</TableCell>
                        <TableCell>{formatMoney(record.deposit)}</TableCell>
                        <td className="max-w-64 px-4 py-3 text-stone-700">
                          <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words pr-2">
                            {record.notes || "-"}
                          </div>
                        </td>
                        {showActionColumn ? (
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex gap-2">
                              {canManage ? (
                                <button
                                  type="button"
                                  onClick={() => startEditRent(record)}
                                  className="font-medium text-pine hover:underline"
                                >
                                  编辑
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRent(record)}
                                  className="font-medium text-red-700 hover:underline"
                                >
                                  删除
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function CompactHead({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 font-semibold">{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
      {children}
    </td>
  );
}

function CompactCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="truncate px-3 py-3 text-stone-700" title={String(children ?? "")}>
      {children}
    </td>
  );
}
