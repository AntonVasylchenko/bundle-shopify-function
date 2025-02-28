import type {
  RunInput,
  FunctionRunResult,
  CartLine,
  CartOperation,
  ProductVariant,
  Product,
} from "../generated/api";

const NO_CHANGES: FunctionRunResult = {
  operations: [],
};

export function run(input: RunInput): FunctionRunResult {
  const groupItems:Record<string, Pick<CartLine, "id" | "quantity" | "attribute" >[]> = {}; 
  const groupItemsExpending:Record<string, Pick<CartLine, "id" | "quantity" | "attribute">[]> = {}; 


  const itemsForMerging = input.cart.lines.filter( line => line.typeOperation?.value === "merge");
  const itemsForExpending = input.cart.lines.filter( line => line.typeOperation?.value === "expande");
  const itemsForUpdate = input.cart.lines.filter((line,_index,array) => {
    const product = (line.merchandise as ProductVariant).product;
    if (!product.freeProduct) return;
    const isMainInCart = array.some(item => (item.merchandise as ProductVariant).product.id === product.freeProduct.value )
    if (isMainInCart && ( array.length == 1 || line.hasFree?.value == "false") ) {      
      return line
    }
  })


  itemsForMerging.forEach( (line) => {
    const bundleId = line.bundleId;

    if (bundleId && bundleId.value) {
      if (!groupItems[bundleId.value]) {
        groupItems[bundleId.value] = [];
      }
      groupItems[bundleId?.value].push(line)
    }
  });
  
  return {
    operations: [
      ...Object.values(groupItems).map( group => {
        const parentId = group[0];        
        const mergeOperations:CartOperation = {
          merge: {
            cartLines: group.map( (line) => {
              return {
                cartLineId: line.id,
                quantity: line.quantity
              }
            }),
            parentVariantId: `gid://shopify/ProductVariant/${parentId.mainId.value}`
          }
        }

        return mergeOperations
      }),
      ...itemsForExpending.map( item => {
        const bundleList = (item.merchandise as ProductVariant).product.bundleList.value;
        const formattedProducts = JSON.parse(bundleList).map((bundle) => ({
          merchandiseId: bundle,
          quantity: item.quantity
      }));
        
        const expandeOperation:CartOperation = {
          expand: {
            cartLineId: item.id,
            expandedCartItems: [...formattedProducts]
          }
        }
        return expandeOperation
      }),

      ...itemsForUpdate.map( item => {
        const {id} = item

        const updateOperation:CartOperation = {
          update: {
            cartLineId: id,
            title: "Free",
            price: {
              adjustment: {
                fixedPricePerUnit: {
                  amount: 0.00
                }
              }
            }
          }
        }
        return updateOperation
      })
      
    ]
  };
};