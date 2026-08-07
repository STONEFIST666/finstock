

import axios from "axios";
export async function getGlobalQuote(stockSymbol) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const params = {
        function: "GLOBAL_QUOTE",
        symbol: stockSymbol,
        apikey: apiKey
    };

    console.log("GLOBAL_QUOTE params:", {
        function: params.function,
        symbol: params.symbol,
        apikeyPresent: Boolean(params.apikey),
        apikeyLength: params.apikey?.length
    });

    const response = await axios.get("https://www.alphavantage.co/query", { params });
    console.log("GLOBAL_QUOTE sent URL:", axios.getUri({ url: "https://www.alphavantage.co/query", params }));
    console.log("GLOBAL_QUOTE response status:", response.status);
    console.log("GLOBAL_QUOTE response data keys:", Object.keys(response.data));

    return response.data;
}

export async function getCompanyOverview(stockSymbol) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const params = {
        function: "OVERVIEW",
        symbol: stockSymbol,
        apikey: apiKey
    };

    console.log("OVERVIEW params:", {
        function: params.function,
        symbol: params.symbol,
        apikeyPresent: Boolean(params.apikey),
        apikeyLength: params.apikey?.length
    });
    console.log("OVERVIEW final URL:", axios.getUri({ url: "https://www.alphavantage.co/query", params }));

    const response = await axios.get("https://www.alphavantage.co/query", { params });
    console.log("OVERVIEW response status:", response.status);
    console.log("OVERVIEW response data:", response.data);
    console.log("OVERVIEW response config url:", response.config.url);
    console.log("OVERVIEW response config params:", response.config.params);

    return response.data;
}