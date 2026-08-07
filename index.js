import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import axios from "axios";
import dotenv from "dotenv";
import { getGlobalQuote } from "./services/alphaVantage.js";
import { getCompanyOverview } from "./services/alphaVantage.js";
dotenv.config();

console.log("ALPHA_VANTAGE_API_KEY loaded:", Boolean(process.env.ALPHA_VANTAGE_API_KEY));
console.log("ALPHA_VANTAGE_API_KEY length:", process.env.ALPHA_VANTAGE_API_KEY?.length);

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const port = 3000;

app.get("/", (req, res) =>{
  res.render("index.ejs", { stock: null, error: null });
});

app.post("/search", async (req, res) => {
    try {
        const stockSymbol = req.body["stock-symbol"];
        const response = await getGlobalQuote(stockSymbol);
        await new Promise(resolve => setTimeout(resolve, 1200));
        const company = await getCompanyOverview(stockSymbol);
        const quote = response["Global Quote"];
        const companyOverview = company;
        console.log("API Response:", response);
        console.log("Quote:", quote);
        if (!quote["01. symbol"]) {
    return res.render("index.ejs", {
        stock: null,
        error: "Invalid stock symbol."
    });
}
        const stock= {
            symbol : quote["01. symbol"],   
            open : quote["02. open"],
            high : quote["03. high"],
            low : quote["04. low"],
            price : quote["05. price"],
            volume : quote["06. volume"],
            previousClose : quote["08. previous close"],
            change : quote["09. change"],
            changePercent : quote["10. change percent"],
            latestTradingDay : quote["07. latest trading day"]
        }
          const companyInfo = {
             name: company.Name,
            description: company.Description,
            sector: company.Sector,
            industry: company.Industry,
            marketCap: company.MarketCapitalization,
            peRatio: company.PERatio,
            eps: company.EPS,
            returnOnEquity: company.ReturnOnEquityTTM,
            profitMargin: company.ProfitMargin,
            dividendYield: company.DividendYield
};
        res.render("index.ejs", { stock: stock , 
            company: companyInfo, error: null });
    } catch (error) {
        console.error("Error fetching stock data:", error);
        res.render("index.ejs", { stock: null, error: "Error fetching stock data" });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



