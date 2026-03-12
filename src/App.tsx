import { useState, useRef } from "react";

type Bit = 0 | 1;

interface CycleState {
  cycle: number;
  awvalid: Bit;
  awready: Bit;
  awaddr: string;
  awlen: number;
  awsize: number;
  awburst: number;
  wvalid: Bit;
  wready: Bit;
  wdata: string;
  wstrb: string;
  wlast: Bit;
  bvalid: Bit;
  bready: Bit;
  bresp: number;
  arvalid: Bit;
  arready: Bit;
  araddr: string;
  arlen: number;
  arsize: number;
  arburst: number;
  rvalid: Bit;
  rready: Bit;
  rdata: string;
  rresp: number;
  rlast: Bit;
  clk: Bit;
  // Per-cycle explanations for each signal
  explain: Partial<
    Record<keyof Omit<CycleState, "cycle" | "clk" | "explain">, string>
  >;
}

type Scenario =
  | "write_normal"
  | "write_stall"
  | "write_burst"
  | "read_normal"
  | "read_backpressure"
  | "read_burst";

const SCENARIOS: Record<
  Scenario,
  { label: string; color: string; desc: string; cycles: CycleState[] }
> = {
  write_normal: {
    label: "Write — Normal",
    color: "#FF6B6B",
    desc: "Single write: AW handshake T1, W handshake T2, B response T3",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid: "IDLE — Master chưa có transaction nào cần gửi",
          awready: "IDLE — Slave chưa cần lắng nghe",
          wvalid: "IDLE — Không có write data",
          wready: "IDLE — Slave chưa chuẩn bị nhận data",
          bvalid: "IDLE — Chưa có write nào hoàn thành để response",
          bready: "IDLE — Master chưa cần đọc response",
        },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 1,
        awready: 0,
        awaddr: "0x1000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 0,
        wdata: "0xDEADBEEF",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "Master assert VALID=1 vì đã có địa chỉ đích 0x1000 sẵn sàng để gửi",
          awready:
            "Slave chưa xử lý xong internal state, chưa READY → Master buộc phải chờ",
          awaddr:
            "Master đặt địa chỉ đích 0x1000 lên bus — phải giữ stable cho đến khi handshake",
          awlen:
            "AWLEN=0 → burst length = 1 beat (single transfer, không phải burst)",
          awsize: "AWSIZE=2 → mỗi beat transfer 4 bytes (2^2 = 4)",
          awburst: "AWBURST=1 → INCR mode: địa chỉ tự tăng sau mỗi beat",
          wvalid:
            "Master cũng assert WVALID=1 cùng lúc — AXI4 cho phép W channel đi trước hoặc cùng AW",
          wready:
            "Slave W-channel cũng chưa READY — cả hai channel đều bị stall 1 cycle",
          wdata:
            "Master đặt data 0xDEADBEEF lên bus — phải giữ stable đến khi WREADY=1",
          wstrb: "WSTRB=0xF → tất cả 4 byte lanes đều valid (1111 binary)",
          wlast: "WLAST=1 vì đây là beat duy nhất (AWLEN=0), cũng là beat cuối",
          bready:
            "Master sẵn sàng nhận write response ngay từ đầu để không làm chậm B channel",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 1,
        awready: 1,
        awaddr: "0x1000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xDEADBEEF",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "Master giữ AWVALID=1 — theo spec AXI4, không được deassert VALID trước khi handshake",
          awready:
            "✅ Slave assert AWREADY=1 → AW HANDSHAKE xảy ra tại rising edge này! Địa chỉ được chấp nhận",
          awaddr:
            "Address được captured vào slave internal register tại rising edge này",
          wvalid: "Master giữ WVALID=1 — data vẫn phải stable",
          wready:
            "✅ Slave assert WREADY=1 → W HANDSHAKE xảy ra đồng thời! Data được ghi vào slave",
          wdata: "0xDEADBEEF được write vào địa chỉ 0x1000 tại cycle này",
          wstrb: "Tất cả 4 bytes được ghi — không có byte nào bị mask",
          wlast:
            "WLAST=1 báo cho slave đây là beat cuối → slave sẽ trigger write response sau cycle này",
          bready:
            "Master tiếp tục giữ BREADY=1 để nhận response ngay khi slave sẵn sàng",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 1,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid: "Master deassert sau handshake — AW channel trở về IDLE",
          awready: "Slave deassert — không còn transaction AW nào pending",
          wvalid: "Master deassert — W data đã được ghi xong ở cycle trước",
          wready: "Slave deassert W channel — write data đã nhận đủ",
          bvalid:
            "✅ Slave assert BVALID=1 — write đã hoàn thành vào memory/register, response sẵn sàng",
          bready:
            "Master vẫn giữ BREADY=1 → B HANDSHAKE xảy ra ngay lập tức, không delay",
          bresp:
            "BRESP=00 = OKAY — write thành công, không có lỗi address decode hay slave error",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          bvalid:
            "Slave deassert sau B handshake — toàn bộ write transaction hoàn tất",
          bready: "Master deassert — đã nhận response xong, không cần giữ nữa",
        },
      },
    ],
  },

  write_stall: {
    label: "Write — Slave Stall",
    color: "#FFD93D",
    desc: "Slave không READY → Master giữ VALID high, chờ 3 cycle rồi handshake",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: { awvalid: "IDLE", wvalid: "IDLE", bvalid: "IDLE" },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 1,
        awready: 0,
        awaddr: "0x2000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 0,
        wdata: "0xBEEFCAFE",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid: "Master assert AWVALID=1 — địa chỉ 0x2000 sẵn sàng",
          awready:
            "Slave đang bận (ví dụ: đang xử lý transaction trước, internal FIFO full) → READY=0",
          wvalid:
            "Master gửi W data đồng thời với AW — pipeline để tiết kiệm latency",
          wready: "Slave W-path cũng bận → chưa thể nhận data",
          wdata:
            "Data phải giữ stable dù chưa được nhận — AXI rule: không thay đổi khi VALID=1",
          bready:
            "Master pre-assert BREADY để tránh thêm latency ở B channel sau này",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 1,
        awready: 0,
        awaddr: "0x2000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 0,
        wdata: "0xBEEFCAFE",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "⏳ STALL cycle 1 — Master buộc phải giữ AWVALID=1, không được hạ xuống",
          awready:
            "Slave vẫn bận — chưa READY. Master không thể làm gì ngoài chờ",
          wvalid: "⏳ STALL — W data vẫn phải stable theo AXI protocol",
          wdata:
            "Không thay đổi — nếu master thay đổi data trong khi VALID=1 là vi phạm spec",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 1,
        awready: 0,
        awaddr: "0x2000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 0,
        wdata: "0xBEEFCAFE",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "⏳ STALL cycle 2 — đây là lý do throughput giảm khi slave chậm",
          awready:
            "Slave vẫn chưa giải phóng — có thể đang flush write buffer hoặc chờ DRAM",
          wvalid: "⏳ STALL cycle 2 — cả AW và W đều bị block",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 1,
        awready: 1,
        awaddr: "0x2000",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xBEEFCAFE",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "Master vẫn giữ VALID — chờ đúng 3 cycle, giờ handshake xảy ra",
          awready:
            "✅ Slave finally READY! AW HANDSHAKE sau 3 cycle stall — địa chỉ được capture",
          wvalid: "Data vẫn valid và stable suốt quá trình chờ",
          wready:
            "✅ W HANDSHAKE cùng lúc — slave nhận data và địa chỉ trong cùng 1 cycle",
          wdata: "0xBEEFCAFE cuối cùng được ghi vào 0x2000 sau 3 cycle chờ",
        },
      },
      {
        cycle: 5,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 1,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          bvalid: "Slave gửi response ngay sau khi write hoàn tất",
          bready:
            "Master đã pre-assert từ cycle 1 → handshake tức thì, không thêm latency",
          bresp: "OKAY — write thành công dù bị stall",
        },
      },
    ],
  },

  write_burst: {
    label: "Write — Burst x4",
    color: "#CE93D8",
    desc: "AWLEN=3 → 4 beat W transfers, WLAST=1 chỉ ở beat cuối, 1 B response",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid: "IDLE — chuẩn bị burst write 4 beat",
          wvalid: "IDLE",
        },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 1,
        awready: 1,
        awaddr: "0x3000",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xAAA1",
        wstrb: "0xF",
        wlast: 0,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid:
            "Master assert AW cho toàn bộ burst — chỉ cần 1 AW handshake cho cả 4 beats",
          awready:
            "✅ Slave READY ngay → AW handshake T1 — slave đã biết: 4 beats INCR từ 0x3000",
          awlen:
            "AWLEN=3 → burst gồm 3+1=4 beats. Slave sẽ expect đúng 4 W transfers",
          awburst: "INCR → địa chỉ tự tăng: 0x3000, 0x3004, 0x3008, 0x300C",
          wvalid:
            "Beat 1/4 — Master bắt đầu stream data ngay cùng lúc với AW handshake",
          wready: "✅ Slave WREADY=1 → W handshake beat 1 xảy ra ngay",
          wdata: "Beat 1: 0xAAA1 → ghi vào 0x3000",
          wlast: "WLAST=0 — đây chưa phải beat cuối, còn 3 beats nữa",
          bready: "Master pre-assert để B handshake xảy ra tức thì sau WLAST",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xAAA2",
        wstrb: "0xF",
        wlast: 0,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          awvalid: "AW channel xong rồi — deassert sau handshake T1",
          wvalid: "Beat 2/4 — Master tiếp tục stream không dừng",
          wready: "Slave vẫn READY — full throughput, không stall",
          wdata: "Beat 2: 0xAAA2 → ghi vào 0x3004 (INCR tự tăng +4)",
          wlast: "WLAST=0 — còn 2 beats nữa",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xAAA3",
        wstrb: "0xF",
        wlast: 0,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          wvalid: "Beat 3/4 — burst vẫn đang chạy full speed",
          wdata: "Beat 3: 0xAAA3 → ghi vào 0x3008",
          wlast: "WLAST=0 — beat cuối là cycle sau",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 1,
        wready: 1,
        wdata: "0xAAA4",
        wstrb: "0xF",
        wlast: 1,
        bvalid: 0,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          wvalid: "Beat 4/4 — beat cuối cùng của burst",
          wdata: "Beat 4: 0xAAA4 → ghi vào 0x300C (địa chỉ cuối)",
          wlast:
            "✅ WLAST=1 — báo slave đây là beat cuối! Slave sẽ kết thúc transaction và chuẩn bị B response",
        },
      },
      {
        cycle: 5,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 1,
        bready: 1,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          wvalid: "Burst hoàn tất — W channel về IDLE",
          bvalid:
            "✅ Slave gửi 1 B response duy nhất cho toàn bộ burst 4 beats — AXI4 chỉ cần 1 response/transaction",
          bresp: "OKAY — cả 4 beats ghi thành công",
        },
      },
    ],
  },

  read_normal: {
    label: "Read — Normal",
    color: "#4FC3F7",
    desc: "AR handshake T1, R data trả về T2 với RLAST=1",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          arvalid: "IDLE — chưa có read request",
          rvalid: "IDLE — slave chưa có data để trả",
        },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 1,
        arready: 0,
        araddr: "0x4000",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 1,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          arvalid: "Master assert ARVALID=1 — yêu cầu đọc từ 0x4000",
          arready:
            "Slave chưa READY — đang decode địa chỉ hoặc fetch data từ memory",
          araddr: "0x4000 là địa chỉ cần đọc — giữ stable đến khi handshake",
          arlen: "ARLEN=0 → single read, không phải burst",
          rready:
            "Master pre-assert RREADY=1 — sẵn sàng nhận data ngay khi slave có",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 1,
        arready: 1,
        araddr: "0x4000",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 1,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          arvalid: "Master giữ ARVALID cho đến handshake",
          arready:
            "✅ AR HANDSHAKE — slave chấp nhận read request, bắt đầu fetch data từ 0x4000",
          rready:
            "Master giữ RREADY — sẵn sàng đón data bất cứ lúc nào slave có",
          rvalid:
            "Slave đang fetch data từ memory — chưa có data để return (read latency)",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xCAFE1234",
        rresp: 0,
        rlast: 1,
        explain: {
          arvalid: "AR channel deassert sau handshake",
          rvalid:
            "✅ Slave assert RVALID=1 — data đã được fetch từ 0x4000, sẵn sàng",
          rready: "Master vẫn READY → R HANDSHAKE xảy ra ngay, zero wait",
          rdata: "0xCAFE1234 — giá trị đọc được từ địa chỉ 0x4000",
          rresp: "RRESP=00=OKAY — đọc thành công",
          rlast:
            "RLAST=1 — beat duy nhất (ARLEN=0), cũng là beat cuối → transaction kết thúc",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid: "Slave deassert — read transaction hoàn tất",
          rready: "Master deassert — đã nhận xong data",
        },
      },
    ],
  },

  read_backpressure: {
    label: "Read — Backpressure",
    color: "#6BCB77",
    desc: "Slave gửi RVALID nhưng Master chưa READY → Slave phải giữ data stable",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: { arvalid: "IDLE", rvalid: "IDLE" },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 1,
        arready: 1,
        araddr: "0x5000",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          arvalid: "Master gửi read request tới 0x5000",
          arready: "✅ AR HANDSHAKE ngay T1 — slave sẵn sàng nhận request",
          rready:
            "Master chưa assert RREADY — master đang bận xử lý việc khác, chưa thể nhận data",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 0,
        rdata: "0xF00DFACE",
        rresp: 0,
        rlast: 1,
        explain: {
          rvalid:
            "Slave fetch data xong, assert RVALID=1 — data 0xF00DFACE sẵn sàng",
          rready:
            "⚠️ Master vẫn chưa READY — có thể đang busy với interrupt handler hoặc pipeline full",
          rdata:
            "Slave phải giữ 0xF00DFACE stable — không được thay đổi khi RVALID=1 mà chưa handshake",
          rlast:
            "RLAST=1 nhưng chưa handshake → slave phải giữ nguyên, chờ master",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 0,
        rdata: "0xF00DFACE",
        rresp: 0,
        rlast: 1,
        explain: {
          rvalid:
            "⏳ BACKPRESSURE cycle 2 — slave bị block, không thể xử lý read request tiếp theo",
          rready:
            "Master vẫn bận — đây là backpressure: consumer chậm hơn producer",
          rdata:
            "Data vẫn phải stable — AXI rule: slave không được thay data khi RVALID=1",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xF00DFACE",
        rresp: 0,
        rlast: 1,
        explain: {
          rvalid: "Slave vẫn giữ RVALID — kiên nhẫn chờ master",
          rready:
            "✅ Master finally READY! R HANDSHAKE sau 2 cycle backpressure",
          rdata:
            "0xF00DFACE được nhận bởi master — giá trị không thay đổi suốt thời gian chờ",
          rlast: "RLAST=1 được nhận → transaction kết thúc",
        },
      },
      {
        cycle: 5,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 0,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 0,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid: "Slave deassert — transaction hoàn tất",
          rready: "Master deassert",
        },
      },
    ],
  },

  read_burst: {
    label: "Read — Burst x4",
    color: "#FF9F7F",
    desc: "ARLEN=3 → Slave trả 4 beat R liên tiếp, RLAST=1 ở beat cuối",
    cycles: [
      {
        cycle: 0,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: { arvalid: "IDLE — chuẩn bị burst read 4 beats" },
      },
      {
        cycle: 1,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 1,
        arready: 1,
        araddr: "0x6000",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 1,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          arvalid:
            "Master request burst read — 1 AR handshake cho toàn bộ burst",
          arready:
            "✅ AR HANDSHAKE ngay — slave biết: cần trả 4 beats từ 0x6000",
          arlen:
            "ARLEN=3 → 4 beats. Slave sẽ tự tính địa chỉ: 0x6000, 0x6004, 0x6008, 0x600C",
          arburst: "INCR — slave tự increment địa chỉ mỗi beat",
          rready: "Master sẵn sàng nhận stream data ngay lập tức",
        },
      },
      {
        cycle: 2,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xD001",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid:
            "Beat 1/4 — slave fetch từ 0x6000, trả về ngay sau 1 cycle latency",
          rready: "Master READY → handshake ngay, full throughput",
          rdata: "0xD001 từ địa chỉ 0x6000",
          rlast: "RLAST=0 — còn 3 beats nữa",
        },
      },
      {
        cycle: 3,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xD002",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid: "Beat 2/4 — slave stream liên tục không dừng",
          rdata: "0xD002 từ 0x6004 (INCR +4)",
          rlast: "RLAST=0 — còn 2 beats",
        },
      },
      {
        cycle: 4,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xD003",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid: "Beat 3/4",
          rdata: "0xD003 từ 0x6008",
          rlast: "RLAST=0 — beat cuối là cycle sau",
        },
      },
      {
        cycle: 5,
        clk: 1,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 1,
        rready: 1,
        rdata: "0xD004",
        rresp: 0,
        rlast: 1,
        explain: {
          rvalid: "Beat 4/4 — beat cuối của burst",
          rdata: "0xD004 từ 0x600C",
          rlast:
            "✅ RLAST=1 — báo master đây là beat cuối. Transaction hoàn tất, không cần B response cho read",
        },
      },
      {
        cycle: 6,
        clk: 0,
        awvalid: 0,
        awready: 0,
        awaddr: "—",
        awlen: 3,
        awsize: 2,
        awburst: 1,
        wvalid: 0,
        wready: 0,
        wdata: "—",
        wstrb: "—",
        wlast: 0,
        bvalid: 0,
        bready: 0,
        bresp: 0,
        arvalid: 0,
        arready: 0,
        araddr: "—",
        arlen: 3,
        arsize: 2,
        arburst: 1,
        rvalid: 0,
        rready: 0,
        rdata: "—",
        rresp: 0,
        rlast: 0,
        explain: {
          rvalid: "Burst hoàn tất — R channel về IDLE",
          rready: "Master deassert",
        },
      },
    ],
  },
};

type SigKind = "clock" | "bit" | "bus";
interface SigDef {
  key: keyof Omit<CycleState,"cycle"|"explain">;
  label: string;
  kind: SigKind;
  color: string;
  group: string;
  driver: "M" | "S" | "CLK";
}

const SIG_DEFS: SigDef[] = [
  {
    key: "clk",
    label: "CLK",
    kind: "clock",
    color: "#FFFFFF",
    group: "CLK",
    driver: "CLK",
  },
  {
    key: "awvalid",
    label: "AWVALID",
    kind: "bit",
    color: "#FF6B6B",
    group: "AW",
    driver: "M",
  },
  {
    key: "awready",
    label: "AWREADY",
    kind: "bit",
    color: "#FFA07A",
    group: "AW",
    driver: "S",
  },
  {
    key: "awaddr",
    label: "AWADDR",
    kind: "bus",
    color: "#FFD93D",
    group: "AW",
    driver: "M",
  },
  {
    key: "awlen",
    label: "AWLEN",
    kind: "bus",
    color: "#FFCC70",
    group: "AW",
    driver: "M",
  },
  {
    key: "awsize",
    label: "AWSIZE",
    kind: "bus",
    color: "#FFCC70",
    group: "AW",
    driver: "M",
  },
  {
    key: "awburst",
    label: "AWBURST",
    kind: "bus",
    color: "#FFCC70",
    group: "AW",
    driver: "M",
  },
  {
    key: "wvalid",
    label: "WVALID",
    kind: "bit",
    color: "#FFD93D",
    group: "W",
    driver: "M",
  },
  {
    key: "wready",
    label: "WREADY",
    kind: "bit",
    color: "#FFF176",
    group: "W",
    driver: "S",
  },
  {
    key: "wdata",
    label: "WDATA",
    kind: "bus",
    color: "#80DEEA",
    group: "W",
    driver: "M",
  },
  {
    key: "wstrb",
    label: "WSTRB",
    kind: "bus",
    color: "#B2DFDB",
    group: "W",
    driver: "M",
  },
  {
    key: "wlast",
    label: "WLAST",
    kind: "bit",
    color: "#FFAB91",
    group: "W",
    driver: "M",
  },
  {
    key: "bvalid",
    label: "BVALID",
    kind: "bit",
    color: "#6BCB77",
    group: "B",
    driver: "S",
  },
  {
    key: "bready",
    label: "BREADY",
    kind: "bit",
    color: "#A5D6A7",
    group: "B",
    driver: "M",
  },
  {
    key: "bresp",
    label: "BRESP",
    kind: "bus",
    color: "#80CBC4",
    group: "B",
    driver: "S",
  },
  {
    key: "arvalid",
    label: "ARVALID",
    kind: "bit",
    color: "#4FC3F7",
    group: "AR",
    driver: "M",
  },
  {
    key: "arready",
    label: "ARREADY",
    kind: "bit",
    color: "#81D4FA",
    group: "AR",
    driver: "S",
  },
  {
    key: "araddr",
    label: "ARADDR",
    kind: "bus",
    color: "#B3E5FC",
    group: "AR",
    driver: "M",
  },
  {
    key: "arlen",
    label: "ARLEN",
    kind: "bus",
    color: "#B0D8F5",
    group: "AR",
    driver: "M",
  },
  {
    key: "arsize",
    label: "ARSIZE",
    kind: "bus",
    color: "#B0D8F5",
    group: "AR",
    driver: "M",
  },
  {
    key: "arburst",
    label: "ARBURST",
    kind: "bus",
    color: "#B0D8F5",
    group: "AR",
    driver: "M",
  },
  {
    key: "rvalid",
    label: "RVALID",
    kind: "bit",
    color: "#CE93D8",
    group: "R",
    driver: "S",
  },
  {
    key: "rready",
    label: "RREADY",
    kind: "bit",
    color: "#E1BEE7",
    group: "R",
    driver: "M",
  },
  {
    key: "rdata",
    label: "RDATA",
    kind: "bus",
    color: "#B39DDB",
    group: "R",
    driver: "S",
  },
  {
    key: "rresp",
    label: "RRESP",
    kind: "bus",
    color: "#D1C4E9",
    group: "R",
    driver: "S",
  },
  {
    key: "rlast",
    label: "RLAST",
    kind: "bit",
    color: "#FFCCBC",
    group: "R",
    driver: "S",
  },
];

const GROUP_COLORS: Record<string, string> = {
  CLK: "#FFFFFF",
  AW: "#FF6B6B",
  W: "#FFD93D",
  B: "#6BCB77",
  AR: "#4FC3F7",
  R: "#CE93D8",
};

function isHandshake(cyc: CycleState, group: string) {
  if (group === "AW") return cyc.awvalid === 1 && cyc.awready === 1;
  if (group === "W") return cyc.wvalid === 1 && cyc.wready === 1;
  if (group === "B") return cyc.bvalid === 1 && cyc.bready === 1;
  if (group === "AR") return cyc.arvalid === 1 && cyc.arready === 1;
  if (group === "R") return cyc.rvalid === 1 && cyc.rready === 1;
  return false;
}

function fmtVal(cyc: CycleState, sig: SigDef): string {
  const v = cyc[sig.key as keyof CycleState];
  if (sig.key === "bresp" || sig.key === "rresp")
    return (
      ({ 0: "OKAY", 2: "SLVERR", 3: "DECERR" } as any)[v as number] ?? String(v)
    );
  if (sig.key === "awburst" || sig.key === "arburst")
    return (
      ({ 0: "FIXED", 1: "INCR", 2: "WRAP" } as any)[v as number] ?? String(v)
    );
  return String(v);
}

const CW = 72,
  RH = 28,
  LW = 88;

function WaveRow({
  sig,
  cycles,
  hoverCol,
  onHover,
  onCellClick,
}: {
  sig: SigDef;
  cycles: CycleState[];
  hoverCol: number | null;
  onHover: (i: number | null) => void;
  onCellClick: (col: number, sig: SigDef) => void;
}) {
  const n = cycles.length,
    W = n * CW;

  if (sig.kind === "clock") {
    let d = `M0,${RH - 6}`;
    for (let i = 0; i < n; i++) {
      const x = i * CW,
        h = CW / 2;
      d += ` L${x},${RH - 6} L${x},6 L${x + h},6 L${x + h},${RH - 6}`;
    }
    d += ` L${W},${RH - 6}`;
    return (
      <svg
        width={W}
        height={RH}
        style={{ display: "block", overflow: "visible" }}
      >
        <path
          d={d}
          stroke="#FFFFFF"
          strokeWidth={1.5}
          fill="none"
          opacity={0.6}
        />
        {cycles.map((_, i) => (
          <rect
            key={i}
            x={i * CW}
            y={0}
            width={CW}
            height={RH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          />
        ))}
      </svg>
    );
  }

  if (sig.kind === "bit") {
    const vals = cycles.map((c) => c[sig.key as keyof CycleState] as Bit);
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = i * CW,
        y = vals[i] === 1 ? 5 : RH - 5,
        py = i > 0 ? (vals[i - 1] === 1 ? 5 : RH - 5) : y;
      if (i === 0) d += `M${x},${y}`;
      else {
        if (py !== y) d += ` L${x},${py} L${x},${y}`;
        else d += ` L${x},${y}`;
      }
    }
    d += ` L${W},${vals[n - 1] === 1 ? 5 : RH - 5}`;
    return (
      <svg
        width={W}
        height={RH}
        style={{ display: "block", overflow: "visible" }}
      >
        {cycles.map(
          (c, i) =>
            c[sig.key as keyof CycleState] === 1 && (
              <rect
                key={i}
                x={i * CW}
                y={5}
                width={CW}
                height={RH - 10}
                fill={sig.color}
                opacity={0.08}
              />
            )
        )}
        <path
          d={d}
          stroke={sig.color}
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="miter"
        />
        {cycles.map((_, i) => (
          <rect
            key={i}
            x={i * CW}
            y={0}
            width={CW}
            height={RH}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onCellClick(i, sig)}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg
      width={W}
      height={RH}
      style={{ display: "block", overflow: "visible" }}
    >
      {cycles.map((cyc, i) => {
        const val = fmtVal(cyc, sig),
          isData = val !== "—",
          x = i * CW,
          mid = RH / 2,
          s = 5;
        return (
          <g key={i}>
            {isData ? (
              <>
                <polygon
                  points={`${x + s},4 ${x + CW - s},4 ${x + CW},${mid} ${
                    x + CW - s
                  },${RH - 4} ${x + s},${RH - 4} ${x},${mid}`}
                  fill={`${sig.color}14`}
                  stroke={sig.color}
                  strokeWidth={1}
                  opacity={0.9}
                />
                <text
                  x={x + CW / 2}
                  y={mid + 4}
                  textAnchor="middle"
                  fill={sig.color}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {val.length > 9 ? val.slice(0, 9) : val}
                </text>
              </>
            ) : (
              <line
                x1={x}
                y1={mid}
                x2={x + CW}
                y2={mid}
                stroke="#1A2A3A"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            )}
            <rect
              x={x}
              y={0}
              width={CW}
              height={RH}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onCellClick(i, sig)}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Tooltip popup ─────────────────────────────────────────────────────────────
interface TooltipState {
  col: number;
  sig: SigDef;
  x: number;
  y: number;
}

export default function AXIWaveform() {
  const [scenario, setScenario] = useState<Scenario>("write_normal");
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const sc = SCENARIOS[scenario];
  const cycles = sc.cycles;
  const visibleSigs = SIG_DEFS.filter((s) => !hiddenGroups.has(s.group));

  const hsEvents: { col: number; group: string }[] = [];
  cycles.forEach((cyc, i) => {
    ["AW", "W", "B", "AR", "R"].forEach((g) => {
      if (isHandshake(cyc, g)) hsEvents.push({ col: i, group: g });
    });
  });

  const handleCellClick = (col: number, sig: SigDef, e: React.MouseEvent) => {
    const rect = (e.target as Element).closest("svg")!.getBoundingClientRect();
    const containerRect = containerRef.current!.getBoundingClientRect();
    if (tooltip?.col === col && tooltip?.sig.key === sig.key) {
      setTooltip(null);
      return;
    }
    setTooltip({
      col,
      sig,
      x: rect.left - containerRect.left + (col % cycles.length) * CW + CW / 2,
      y: rect.top - containerRect.top,
    });
  };

  const cyc = tooltip ? cycles[tooltip.col] : null;
  const explainText =
    cyc && tooltip
      ? ((cyc.explain as any)[tooltip.sig.key] as string | undefined)
      : undefined;
  const tooltipVal = cyc && tooltip ? fmtVal(cyc, tooltip.sig) : "";

  return (
    <div
      ref={containerRef}
      style={{
        background: "#060A0F",
        minHeight: "100vh",
        fontFamily: "'JetBrains Mono',monospace",
        color: "#C8D8E8",
        position: "relative",
      }}
      onClick={(e) => {
        if ((e.target as Element).tagName === "rect") return;
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-thumb{background:#1E3040;border-radius:3px;}
      `}</style>

      {/* Top bar */}
      <div
        style={{
          borderBottom: "1px solid #0E1E2E",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          background: "#080D14",
          position: "sticky",
          top: 0,
          zIndex: 200,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.5em",
              color: "#2A6080",
              marginBottom: 2,
            }}
          >
            AMBA AXI4 PROTOCOL
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              background: "linear-gradient(90deg,#4FC3F7,#CE93D8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AXI Waveform Viewer
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setScenario(s);
                setTooltip(null);
              }}
              style={{
                background:
                  scenario === s
                    ? `${SCENARIOS[s].color}22`
                    : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  scenario === s ? SCENARIOS[s].color : "#1A2A3A"
                }`,
                color: scenario === s ? SCENARIOS[s].color : "#446688",
                fontFamily: "monospace",
                fontSize: 10,
                fontWeight: 700,
                padding: "5px 11px",
                borderRadius: 5,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {SCENARIOS[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Desc + group toggles */}
      <div
        style={{
          padding: "8px 20px",
          background: `${sc.color}0A`,
          borderBottom: `1px solid ${sc.color}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: sc.color }}>◆ {sc.desc}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["CLK", "AW", "W", "B", "AR", "R"].map((g) => (
            <button
              key={g}
              onClick={() =>
                setHiddenGroups((prev) => {
                  const n = new Set(prev);
                  n.has(g) ? n.delete(g) : n.add(g);
                  return n;
                })
              }
              style={{
                background: hiddenGroups.has(g)
                  ? "transparent"
                  : `${GROUP_COLORS[g]}18`,
                border: `1px solid ${
                  hiddenGroups.has(g) ? "#1A2A3A" : GROUP_COLORS[g] + "55"
                }`,
                color: hiddenGroups.has(g) ? "#2A4A5A" : GROUP_COLORS[g],
                fontFamily: "monospace",
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 4,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div
        style={{
          padding: "6px 20px",
          fontSize: 10,
          color: "#1A3A4A",
          background: "#060A0F",
          borderBottom: "1px solid #0A1520",
          letterSpacing: "0.1em",
        }}
      >
        💡 CLICK vào bất kỳ signal cell nào để xem giải thích tại sao signal đó
        có giá trị đó
      </div>

      {/* Waveform */}
      <div style={{ overflowX: "auto", overflowY: "auto", paddingBottom: 80 }}>
        <div
          style={{
            minWidth: LW + cycles.length * CW + 32,
            padding: "8px 16px 24px",
            position: "relative",
          }}
        >
          {/* Cycle header */}
          <div style={{ display: "flex", marginLeft: LW, marginBottom: 4 }}>
            {cycles.map((c, i) => (
              <div
                key={i}
                style={{
                  width: CW,
                  flexShrink: 0,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: hoverCol === i ? "#FFD93D" : "#2A4A5A",
                  background:
                    hoverCol === i ? "rgba(255,217,61,0.05)" : "transparent",
                  padding: "2px 0",
                  transition: "color 0.1s",
                  borderBottom: `1px solid ${
                    hoverCol === i ? "#FFD93D44" : "#0E1E2E"
                  }`,
                }}
              >
                T{c.cycle}
              </div>
            ))}
          </div>

          {visibleSigs.map((sig, si) => {
            const isGroupStart =
              si === 0 || visibleSigs[si - 1].group !== sig.group;
            return (
              <div key={sig.key}>
                {isGroupStart && sig.group !== "CLK" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 6,
                      marginBottom: 2,
                      marginLeft: LW,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 1,
                        background: `${GROUP_COLORS[sig.group]}44`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.4em",
                        color: GROUP_COLORS[sig.group],
                        opacity: 0.6,
                      }}
                    >
                      {sig.group} CHANNEL
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: `linear-gradient(90deg,${
                          GROUP_COLORS[sig.group]
                        }33,transparent)`,
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: RH,
                    background:
                      hoverCol !== null
                        ? "rgba(255,217,61,0.008)"
                        : "transparent",
                  }}
                >
                  {/* Label */}
                  <div
                    style={{
                      width: LW,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingRight: 8,
                      gap: 4,
                      height: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background:
                          sig.driver === "M"
                            ? "rgba(255,107,107,0.15)"
                            : sig.driver === "S"
                            ? "rgba(107,203,119,0.15)"
                            : "rgba(255,255,255,0.06)",
                        color:
                          sig.driver === "M"
                            ? "#FF6B6B"
                            : sig.driver === "S"
                            ? "#6BCB77"
                            : "#888",
                        border: `1px solid ${
                          sig.driver === "M"
                            ? "rgba(255,107,107,0.3)"
                            : sig.driver === "S"
                            ? "rgba(107,203,119,0.3)"
                            : "rgba(255,255,255,0.1)"
                        }`,
                      }}
                    >
                      {sig.driver}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: sig.color,
                        textAlign: "right",
                      }}
                    >
                      {sig.label}
                    </span>
                  </div>

                  {/* Wave + overlays */}
                  <div
                    style={{ position: "relative", cursor: "pointer" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hoverCol !== null && (
                      <div
                        style={{
                          position: "absolute",
                          left: hoverCol * CW,
                          top: 0,
                          width: CW,
                          height: RH,
                          background: "rgba(255,217,61,0.04)",
                          borderLeft: "1px solid rgba(255,217,61,0.15)",
                          borderRight: "1px solid rgba(255,217,61,0.15)",
                          pointerEvents: "none",
                          zIndex: 1,
                        }}
                      />
                    )}
                    {/* Tooltip highlight */}
                    {tooltip && tooltip.sig.key === sig.key && (
                      <div
                        style={{
                          position: "absolute",
                          left: tooltip.col * CW,
                          top: 0,
                          width: CW,
                          height: RH,
                          background: `${sig.color}22`,
                          border: `1px solid ${sig.color}88`,
                          pointerEvents: "none",
                          zIndex: 3,
                          borderRadius: 2,
                        }}
                      />
                    )}
                    {/* Handshake markers */}
                    {hsEvents.map(
                      (ev, ei) =>
                        ev.group === sig.group && (
                          <div
                            key={ei}
                            style={{
                              position: "absolute",
                              left: ev.col * CW,
                              top: 0,
                              width: CW,
                              height: RH,
                              background: `${GROUP_COLORS[sig.group]}10`,
                              borderLeft: `2px solid ${
                                GROUP_COLORS[sig.group]
                              }77`,
                              pointerEvents: "none",
                              zIndex: 2,
                            }}
                          >
                            {sig ===
                              visibleSigs.find((s) => s.group === ev.group) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: -14,
                                  left: 2,
                                  fontSize: 8,
                                  color: GROUP_COLORS[ev.group],
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ✓HS
                              </div>
                            )}
                          </div>
                        )
                    )}
                    <WaveRow
                      sig={sig}
                      cycles={cycles}
                      hoverCol={hoverCol}
                      onHover={setHoverCol}
                      onCellClick={(col, s) => {
                        const el = document.elementFromPoint(0, 0); // dummy
                        // find click pos from hoverCol
                        const fakeSynth = {
                          col,
                          sig: s,
                          x: LW + col * CW + CW / 2,
                          y: (si + 2) * (RH + 2),
                        };
                        if (
                          tooltip?.col === col &&
                          tooltip?.sig.key === s.key
                        ) {
                          setTooltip(null);
                        } else {
                          setTooltip(fakeSynth);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip panel — fixed bottom */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 300,
            background: "#0A1520",
            borderTop: "2px solid #1A3A5A",
            padding: "14px 24px",
            animation: "slideUp 0.2s ease",
          }}
        >
          <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}`}</style>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* Signal + cycle badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: tooltip.sig.color,
                      background: `${tooltip.sig.color}18`,
                      border: `1px solid ${tooltip.sig.color}55`,
                      padding: "3px 10px",
                      borderRadius: 4,
                    }}
                  >
                    {tooltip.sig.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#446688" }}>
                    @ T{cycles[tooltip.col].cycle}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        tooltipVal === "0"
                          ? "#445566"
                          : tooltipVal === "—"
                          ? "#2A4A5A"
                          : tooltip.sig.color,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      padding: "2px 10px",
                      borderRadius: 4,
                      fontFamily: "monospace",
                    }}
                  >
                    = {tooltipVal}
                  </span>
                  {/* Handshake badge */}
                  {isHandshake(cycles[tooltip.col], tooltip.sig.group) && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#FFD93D",
                        background: "rgba(255,217,61,0.12)",
                        border: "1px solid rgba(255,217,61,0.35)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 700,
                      }}
                    >
                      ✓ HANDSHAKE
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color:
                        tooltip.sig.driver === "M"
                          ? "#FF6B6B"
                          : tooltip.sig.driver === "S"
                          ? "#6BCB77"
                          : "#888",
                    }}
                  >
                    driven by{" "}
                    {tooltip.sig.driver === "M"
                      ? "MASTER"
                      : tooltip.sig.driver === "S"
                      ? "SLAVE"
                      : "SYSTEM"}
                  </span>
                </div>

                {/* Explanation */}
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: explainText
                      ? explainText.includes("✅")
                        ? "#A8E6AF"
                        : explainText.includes("⏳") ||
                          explainText.includes("⚠️")
                        ? "#FFE082"
                        : "#B8CCE0"
                      : "#3A5A6A",
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      explainText
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.02)"
                    }`,
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                >
                  {explainText ?? (
                    <span style={{ color: "#2A4A5A", fontStyle: "italic" }}>
                      Signal này không hoạt động trong scenario này — không có
                      explanation cho cycle này
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setTooltip(null)}
                style={{
                  background: "transparent",
                  border: "1px solid #1A3A4A",
                  color: "#4A6A7A",
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                ✕ đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ height: 8 }} />
    </div>
  );
}
