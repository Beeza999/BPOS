import React from "react";
import { money } from "../../../lib/api.js";

export default function MenuPage({
  menu,
  setMenu,
  cats,
  menus,
  saveMenu,
  editingMenuId,
  editMenu,
  cancelEditMenu,
  toggleMenu,
  deleteMenu,
}) {
  function useLocalImage(file) {
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("ຮູບໃຫຍ່ເກີນໄປ ກະລຸນາໃຊ້ຮູບບໍ່ເກີນ 500KB ຫຼືໃຊ້ URL ຮູບພາບ");
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      setMenu({ ...menu, imageUrl: String(reader.result || "") });

    reader.readAsDataURL(file);
  }

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ຈັດການເມນູ</h2>
        <p className="text-sm text-slate-500">
          ເພີ່ມ, ແກ້ໄຂ, ລົບ, ເປີດ/ປິດຂາຍ ແລະ ໃສ່ຮູບຈາກ URL ຫຼື
          ເລືອກຮູບຈາກເຄື່ອງ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={saveMenu} className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-bold">
              {editingMenuId ? "ແກ້ໄຂເມນູ" : "+ ເພີ່ມເມນູ"}
            </h3>

            {editingMenuId && (
              <button
                type="button"
                onClick={cancelEditMenu}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
              >
                ຍົກເລີກ
              </button>
            )}
          </div>

          <input
            required
            className="input w-full"
            placeholder="ຊື່ເມນູ"
            value={menu.name}
            onChange={(e) => setMenu({ ...menu, name: e.target.value })}
          />

          <select
            className="input w-full"
            value={menu.categoryId}
            onChange={(e) => setMenu({ ...menu, categoryId: e.target.value })}
          >
            {cats.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            className="input w-full"
            type="number"
            placeholder="ລາຄາ"
            value={menu.price}
            onChange={(e) => setMenu({ ...menu, price: e.target.value })}
          />

          <input
            className="input w-full"
            placeholder="URL ຮູບພາບ"
            value={menu.imageUrl}
            onChange={(e) => setMenu({ ...menu, imageUrl: e.target.value })}
          />

          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-600">
            <span>ເລືອກຮູບຈາກເຄື່ອງ</span>
            <input
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-xs"
              onChange={(e) => useLocalImage(e.target.files?.[0])}
            />
          </label>

          {menu.imageUrl && (
            <div className="overflow-hidden rounded-2xl bg-slate-100">
              <img
                src={menu.imageUrl}
                className="h-32 w-full object-cover"
                alt="menu preview"
              />
            </div>
          )}

          <textarea
            className="input w-full"
            placeholder="ຄຳອະທິບາຍ"
            value={menu.description}
            onChange={(e) => setMenu({ ...menu, description: e.target.value })}
          />

          <select
            className="input w-full"
            value={menu.station}
            onChange={(e) => setMenu({ ...menu, station: e.target.value })}
          >
            <option value="HOT">ຄົວຮ້ອນ</option>
            <option value="BAR">ບານ້ຳ</option>
            <option value="DESSERT">ຂອງຫວານ</option>
            <option value="OTHER">ອື່ນໆ</option>
          </select>

          <label className="flex gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={menu.isRecommended}
              onChange={(e) =>
                setMenu({ ...menu, isRecommended: e.target.checked })
              }
            />
            ເມນູແນະນຳ
          </label>

          <label className="flex gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={menu.isAvailable}
              onChange={(e) =>
                setMenu({ ...menu, isAvailable: e.target.checked })
              }
            />
            ເປີດຂາຍ
          </label>

          <button className="btn w-full bg-orange-500 text-white">
            {editingMenuId ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກ"}
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((m) => (
            <article
              className={`overflow-hidden rounded-3xl bg-white shadow-sm ${
                editingMenuId === m.id ? "ring-2 ring-orange-400" : ""
              }`}
              key={m.id}
            >
              <div className="flex h-36 items-center justify-center bg-slate-100 text-4xl">
                {m.imageUrl ? (
                  <img
                    src={m.imageUrl}
                    className="h-full w-full object-cover"
                    alt={m.name}
                  />
                ) : (
                  "🍽️"
                )}
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold">{m.name}</h3>
                <p className="text-sm text-slate-500">
                  {m.category?.name} · {m.station}
                </p>

                <p className="mt-2 text-xl font-bold text-orange-600">
                  {money(m.price)}
                </p>

                <p
                  className={`mt-1 text-sm font-bold ${
                    m.isAvailable ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {m.isAvailable ? "ເປີດຂາຍ" : "ປິດເມນູ"}
                </p>

                {m.isRecommended && (
                  <p className="mt-1 text-xs font-bold text-blue-600">
                    ເມນູແນະນຳ
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                    onClick={() => editMenu(m)}
                  >
                    ແກ້ໄຂ
                  </button>

                  <button
                    className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"
                    onClick={() => toggleMenu(m)}
                  >
                    {m.isAvailable ? "ປິດ" : "ເປີດ"}
                  </button>

                  <button
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                    onClick={() => deleteMenu(m.id)}
                  >
                    ລົບ
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
