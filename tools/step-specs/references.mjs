// Ladder steps for the "references" track (docs/content.md, Ladder steps). The
// YAML files are the source of truth once written: variants added later by
// tools/suggest-variants.ts and by hand live only there, so do not --write this again.
// Each exercise's own slot: level 1 at step 1, level 2 at step 3.
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

export default [
  // add-two-cells (level 1, step 1)
  {
    parent: "add-two-cells",
    step: 2,
    level: 1,
    title: "Add three cells",
    screens: [
      {
        prompt: "In B5, add the price in B2, the delivery in B3 and the gift wrap in B4.",
        rows: [
          ["Item", "Cost"],
          ["Price", 36],
          ["Delivery", 4.5],
          ["Gift wrap", 2.25],
          ["Total", null],
        ],
        cell: "B5",
        answer: "=B2+B3+B4",
        required: [],
        accept: ["=B4+B3+B2", "=SUM(B2:B4)"],
        variants: [{ B3: 6 }],
        reject: [["=B2+B3", "value"]],
        nudge: "Join the three cells with plus signs.",
        rule: "A plus sign adds the cell on each side, so B2+B3+B4 adds all three.",
        value: (e) => `The three costs add up to ${fmt(e)}. Include B2, B3 and B4.`,
      },
    ],
  },
  {
    parent: "add-two-cells",
    step: 3,
    level: 2,
    title: "Add a charge kept in one cell",
    screens: [
      {
        prompt:
          "In C4, add the delivery charge in F1 to the price of the lamp in B4. The charge is the same for every item.",
        rows: [
          ["Item", "Price", "With delivery", null, "Delivery", 3.95],
          ["Mug", 8.5, null, null, null, null],
          ["Vase", 24, null, null, null, null],
          ["Lamp", 39.9, null, null, null, null],
          ["Rug", 64, null, null, null, null],
        ],
        cell: "C4",
        answer: "=B4+$F$1",
        required: [],
        accept: ["=B4+F1", "=$F$1+B4"],
        variants: [{ F1: 5.5 }],
        reject: [
          ["=B4+B3", "value"],
          ["=B4+3.95", "reference"],
        ],
        nudge: "The delivery charge sits in F1, at the top right.",
        rule: "Point at F1 for the charge. Writing it as $F$1 keeps it fixed if the formula is copied down to the other items.",
        value: (e) => `The lamp with delivery comes to ${fmt(e)}. Add B4 and F1.`,
      },
    ],
  },
  {
    parent: "add-two-cells",
    step: 4,
    level: 2,
    title: "Running balance with plus and minus",
    screens: [
      {
        prompt:
          "In D4, give the balance after line 2: the balance above in D3, plus the money in from B4, minus the money out in C4.",
        rows: [
          ["Line", "In", "Out", "Balance"],
          ["Opening", 0, 0, 250],
          ["1", 120, 45, 325],
          ["2", 0, 80, null],
          ["3", 60, 15, null],
        ],
        cell: "D4",
        answer: "=D3+B4-C4",
        required: [],
        accept: ["=B4-C4+D3", "=D3+(B4-C4)"],
        variants: [{ C4: 100 }],
        reject: [
          ["=D3+B4+C4", "value"],
          ["=B4-C4", "value"],
        ],
        nudge: "Start from the balance above, add what came in, take away what went out.",
        rule: "D3+B4-C4 carries the balance forward one line.",
        value: (e) => `The balance after line 2 is ${e}. Start from D3, add B4 and take away C4.`,
      },
    ],
  },
  {
    parent: "add-two-cells",
    step: 5,
    level: 3,
    title: "What the customer pays",
    screens: [
      {
        prompt:
          "In B5, what does the customer pay in total? Delivery in B3 is free when the price in B2 is 50 or more.",
        rows: [
          ["Item", "Cost"],
          ["Price", 42],
          ["Delivery", 4.99],
          ["Free delivery from", 50],
          ["To pay", null],
        ],
        cell: "B5",
        answer: "=B2+IF(B2>=B4,0,B3)",
        required: [],
        accept: ["=IF(B2>=B4,B2,B2+B3)", "=B2+(B2<B4)*B3"],
        variants: [{ B2: 60 }, { B2: 50 }, { B3: 6.5 }],
        reject: [
          ["=B2+B3", "fragile"],
          ["=B2+IF(B2>B4,0,B3)", "fragile"],
        ],
        nudge: "Add the delivery only when the price is under the limit in B4.",
        rule: "IF(B2>=B4,0,B3) gives 0 for delivery at the limit or above, and the charge below it. Add that to the price.",
        value: (e) => `The customer pays ${fmt(e)} here. Delivery counts only below the limit.`,
      },
    ],
  },

  // subtract-costs (level 1, step 1)
  {
    parent: "subtract-costs",
    step: 2,
    level: 1,
    title: "Budget left after two costs",
    screens: [
      {
        prompt:
          "In E2, work out what is left of the budget in B2 after the amount spent in C2 and the amount booked in D2.",
        rows: [
          ["Project", "Budget", "Spent", "Booked", "Left"],
          ["Website", 12000, 7450, 2300, null],
        ],
        cell: "E2",
        answer: "=B2-C2-D2",
        required: [],
        accept: ["=B2-(C2+D2)", "=B2-SUM(C2:D2)"],
        variants: [{ D2: 3000 }],
        reject: [
          ["=B2-C2", "value"],
          ["=B2-C2+D2", "value"],
        ],
        nudge: "Take both costs away from the budget.",
        rule: "B2-C2-D2 takes the spent amount and then the booked amount off the budget.",
        value: (e) => `The budget left is ${e}. Take away both C2 and D2.`,
      },
    ],
  },
  {
    parent: "subtract-costs",
    step: 3,
    level: 2,
    title: "Stock left at the end of the week",
    screens: [
      {
        prompt:
          "In E2, work out the stock left: the opening stock in B2, plus the delivery in C2, minus the units sold in D2.",
        rows: [
          ["Item", "Opening", "Delivered", "Sold", "Left"],
          ["Printer paper", 140, 200, 265, null],
        ],
        cell: "E2",
        answer: "=B2+C2-D2",
        required: [],
        accept: ["=C2+B2-D2", "=B2-D2+C2"],
        variants: [{ C2: 150 }],
        reject: [
          ["=B2-C2-D2", "value"],
          ["=B2-D2", "value"],
        ],
        nudge: "Deliveries add to the stock and sales take it away.",
        rule: "B2+C2-D2 adds what came in and takes away what went out.",
        value: (e) => `The stock left is ${e}. Add the delivery and take away the sales.`,
      },
    ],
  },
  {
    parent: "subtract-costs",
    step: 4,
    level: 2,
    title: "Profit as a share of revenue",
    screens: [
      {
        prompt:
          "In D2, work out the profit margin: the profit, revenue minus costs, divided by the revenue. Show it as a fraction, so 0.25 means 25%.",
        rows: [
          ["Month", "Revenue", "Costs", "Margin"],
          ["April", 9600, 7200, null],
        ],
        cell: "D2",
        answer: "=(B2-C2)/B2",
        required: [],
        accept: ["=1-C2/B2", "=(B2-C2)/B2*1"],
        variants: [{ C2: 6000 }],
        reject: [
          ["=B2-C2/B2", "value"],
          ["=(B2-C2)/C2", "value"],
        ],
        nudge: "Work out the profit first, in brackets, then divide.",
        rule: "Excel divides before it subtracts, so the brackets in (B2-C2)/B2 make the subtraction happen first.",
        value: (e) => `The margin is ${e}: the profit, in brackets, divided by the revenue in B2.`,
      },
    ],
  },
  {
    parent: "subtract-costs",
    step: 5,
    level: 3,
    title: "How much more the better month made",
    screens: [
      {
        prompt:
          "In B5, how much more profit did the better of the two months make than the other? Give a positive number.",
        rows: [
          ["Month", "Revenue", "Costs"],
          ["May", 10400, 7900],
          ["June", 9800, 6750],
          [null, null, null],
          ["Gap", null, null],
        ],
        cell: "B5",
        answer: "=ABS((B2-C2)-(B3-C3))",
        required: [],
        accept: ["=MAX(B2-C2,B3-C3)-MIN(B2-C2,B3-C3)", "=ABS(B3-C3-B2+C2)"],
        variants: [{ C2: 6000 }, { B3: 9000 }],
        reject: [
          ["=(B2-C2)-(B3-C3)", "value"],
          ["=(B3-C3)-(B2-C2)", "fragile"],
        ],
        nudge: "Work out each month's profit, take one from the other, then drop the sign.",
        rule: "ABS turns a negative gap into a positive one, so the answer is right whichever month did better.",
        value: (e) => `The gap between the two profits is ${e}. It has to be positive.`,
      },
    ],
  },

  // multiply-price-by-quantity (level 1, step 1)
  {
    parent: "multiply-price-by-quantity",
    step: 2,
    level: 1,
    title: "Multiply three cells",
    screens: [
      {
        prompt:
          "In E2, work out the volume of the box: the length times the width times the height.",
        rows: [
          ["Box", "Length", "Width", "Height", "Volume"],
          ["Large", 60, 40, 35, null],
        ],
        cell: "E2",
        answer: "=B2*C2*D2",
        required: [],
        accept: ["=D2*C2*B2", "=PRODUCT(B2:D2)"],
        variants: [{ D2: 50 }],
        reject: [["=B2*C2", "value"]],
        nudge: "Join the three cells with the * sign.",
        rule: "The * sign multiplies, so B2*C2*D2 multiplies all three.",
        value: (e) => `The volume is ${e}. Multiply all three sizes.`,
      },
    ],
  },
  {
    parent: "multiply-price-by-quantity",
    step: 3,
    level: 2,
    title: "Convert a price with a rate in one cell",
    screens: [
      {
        prompt:
          "In C4, convert the price of the chair in B4 to euros, using the exchange rate in F1.",
        rows: [
          ["Item", "Price (USD)", "Price (EUR)", null, "Rate", 0.92],
          ["Desk", 249, null, null, null, null],
          ["Shelf", 89, null, null, null, null],
          ["Chair", 159, null, null, null, null],
          ["Lamp", 45, null, null, null, null],
        ],
        cell: "C4",
        answer: "=B4*$F$1",
        required: [],
        accept: ["=B4*F1", "=$F$1*B4"],
        variants: [{ F1: 0.95 }],
        reject: [
          ["=B4*0.92", "reference"],
          ["=B4/$F$1", "value"],
        ],
        nudge: "The rate sits in F1, at the top right.",
        rule: "Multiply the price by F1. Writing it as $F$1 keeps it fixed if the formula is copied down.",
        value: (e) => `The chair costs ${fmt(e)} in euros. Multiply B4 by F1.`,
      },
    ],
  },
  {
    parent: "multiply-price-by-quantity",
    step: 4,
    level: 2,
    title: "Total of a two-line order",
    screens: [
      {
        prompt:
          "In C5, work out the order total: the first line's price times its quantity, plus the second line's price times its quantity.",
        rows: [
          ["Product", "Price", "Quantity"],
          ["Pens", 1.2, 25],
          ["Pads", 3.5, 12],
          [null, null, null],
          ["Order total", null, null],
        ],
        cell: "C5",
        answer: "=B2*C2+B3*C3",
        required: [],
        accept: ["=(B2*C2)+(B3*C3)", "=SUMPRODUCT(B2:B3,C2:C3)"],
        variants: [{ C3: 20 }],
        reject: [
          ["=(B2+B3)*(C2+C3)", "value"],
          ["=B2*C2+B3", "value"],
        ],
        nudge: "Work out each line's total, then add the two.",
        rule: "Excel multiplies before it adds, so B2*C2+B3*C3 needs no brackets.",
        value: (e) => `The order comes to ${fmt(e)}. Multiply each line, then add.`,
      },
    ],
  },
  {
    parent: "multiply-price-by-quantity",
    step: 5,
    level: 3,
    title: "What the whole order is worth",
    screens: [
      {
        prompt: "In F2, what is the whole order worth? Each line has a price and a quantity.",
        rows: [
          ["Product", "Price", "Quantity", null, null, null],
          ["Pens", 1.2, 40, null, "Order value", null],
          ["Pads", 3.5, 15, null, null, null],
          ["Clips", 0.05, 500, null, null, null],
          ["Tape", 2.1, 12, null, null, null],
          ["Files", 4.75, 20, null, null, null],
          ["Ink", 18.9, 6, null, null, null],
          ["Glue", 1.85, 30, null, null, null],
          ["Rulers", 0.9, 25, null, null, null],
          ["Folders", 0.6, 100, null, null, null],
          ["Labels", 5.4, 8, null, null, null],
          ["Staples", 1.1, 18, null, null, null],
          ["Markers", 7.25, 10, null, null, null],
          ["Erasers", 0.35, 60, null, null, null],
          ["Binders", 3.9, 14, null, null, null],
          ["Sticky notes", 2.6, 22, null, null, null],
        ],
        cell: "F2",
        answer: "=SUMPRODUCT(B2:B16,C2:C16)",
        required: [],
        accept: ["=SUM(B2:B16*C2:C16)", "=SUMPRODUCT(B2:B16*C2:C16)"],
        variants: [{ C7: 10 }, { B16: 3 }],
        reject: [
          ["=SUM(B2:B16)*SUM(C2:C16)", "value"],
          ["=SUMPRODUCT(B2:B15,C2:C15)", "value"],
        ],
        nudge: "Multiply each price by its quantity, then add up all the lines.",
        rule: "SUMPRODUCT(B2:B16,C2:C16) multiplies each pair of cells and adds the results in one step.",
        value: (e) =>
          `The order is worth ${fmt(e)}: each price times its quantity, added up over all 15 lines.`,
      },
    ],
  },

  // price-after-discount (level 2, step 3)
  {
    parent: "price-after-discount",
    step: 1,
    level: 1,
    title: "How much the discount takes off",
    screens: [
      {
        prompt:
          "In D2, work out how much the discount takes off: the price in B2 times the discount in C2. The discount is a fraction, so 0.2 means 20% off.",
        rows: [
          ["Item", "Price", "Discount", "Amount off"],
          ["Boots", 95, 0.2, null],
        ],
        cell: "D2",
        answer: "=B2*C2",
        required: [],
        accept: ["=C2*B2"],
        variants: [{ C2: 0.3 }],
        reject: [
          ["=B2-C2", "value"],
          ["=B2*(1-C2)", "value"],
        ],
        nudge: "A fraction of a price is the price times the fraction.",
        rule: "B2*C2 gives the part of the price the discount removes.",
        value: (e) => `The discount takes ${e} off. Multiply the price by the discount.`,
      },
    ],
  },
  {
    parent: "price-after-discount",
    step: 2,
    level: 2,
    title: "Price with tax added",
    screens: [
      {
        prompt:
          "In D2, work out the price with tax: the price in B2 plus the tax rate in C2 on top. The rate is a fraction, so 0.2 means 20%.",
        rows: [
          ["Item", "Price", "Tax rate", "With tax"],
          ["Headphones", 65, 0.2, null],
        ],
        cell: "D2",
        answer: "=B2*(1+C2)",
        required: [],
        accept: ["=B2+B2*C2", "=(1+C2)*B2"],
        variants: [{ C2: 0.15 }],
        reject: [
          ["=B2+C2", "value"],
          ["=B2*1+C2", "value"],
        ],
        nudge: "With tax, the price is the whole price plus the rate on top: 1 plus the rate.",
        rule: "B2*(1+C2) adds the tax in one step. The brackets make Excel add before it multiplies.",
        value: (e) => `The price with tax is ${e}. Multiply B2 by 1 plus C2.`,
      },
    ],
  },
  {
    parent: "price-after-discount",
    step: 4,
    level: 2,
    title: "Sale price with one discount for all",
    screens: [
      {
        prompt:
          "In C4, work out the sale price of the coat in B4. The store-wide discount is in F1 as a fraction, so 0.3 means 30% off.",
        rows: [
          ["Item", "Price", "Sale price", null, "Discount", 0.3],
          ["Shirt", 40, null, null, null, null],
          ["Jeans", 70, null, null, null, null],
          ["Coat", 150, null, null, null, null],
          ["Scarf", 25, null, null, null, null],
        ],
        cell: "C4",
        answer: "=B4*(1-$F$1)",
        required: [],
        accept: ["=B4*(1-F1)", "=B4-B4*$F$1"],
        variants: [{ F1: 0.25 }],
        reject: [
          ["=B4*$F$1", "value"],
          ["=B4*0.7", "fragile"],
        ],
        nudge: "The discount is in F1. What is left to pay is 1 minus the discount.",
        rule: "B4*(1-$F$1) gives the price after the discount. $F$1 keeps the discount cell fixed if the formula is copied down.",
        value: (e) => `The coat costs ${e} in the sale. Multiply B4 by 1 minus F1.`,
      },
    ],
  },
  {
    parent: "price-after-discount",
    step: 5,
    level: 3,
    title: "Price after two discounts in a row",
    screens: [
      {
        prompt:
          "In E2, what does the sofa cost after the sale discount in C2 and then the member discount in D2 on what is left? Both are fractions.",
        rows: [
          ["Item", "Price", "Sale", "Member", "To pay"],
          ["Sofa", 900, 0.2, 0.1, null],
        ],
        cell: "E2",
        answer: "=B2*(1-C2)*(1-D2)",
        required: [],
        accept: ["=B2*(1-C2)-B2*(1-C2)*D2", "=(B2-B2*C2)*(1-D2)"],
        variants: [{ D2: 0.15 }, { C2: 0.25 }],
        reject: [
          ["=B2*(1-C2-D2)", "value"],
          ["=B2*(1-C2)", "value"],
        ],
        nudge: "Take the first discount off, then take the second off what is left.",
        rule: "B2*(1-C2)*(1-D2) applies one discount after the other. Adding the two rates first takes off too much.",
        value: (e) =>
          `The sofa costs ${e} after both discounts, the second taken off what is left after the first.`,
      },
    ],
  },
];
