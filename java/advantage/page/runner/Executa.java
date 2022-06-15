package advantage.page.runner;

import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.runner.RunWith;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;

import advantage.page.drivers.DriversFactory;
import io.cucumber.junit.Cucumber;
import io.cucumber.junit.CucumberOptions;
import io.cucumber.junit.CucumberOptions.SnippetType;

@RunWith(Cucumber.class)
@CucumberOptions(features = "Src/test/resources/features",
		glue = "advantage.page.steps",
		tags = "@all",
		monochrome = true,
		dryRun = false,
		plugin = { "pretty", "html:target/cucumber-report.html" },
		snippets = SnippetType.CAMELCASE
)

	public class Executa extends DriversFactory {
	
	static String url = "https://www.advantageonlineshopping.com/#/";
	static String browser = "Chrome";
	
@BeforeClass
	public static void iniciarTeste() {
	
	if (browser.equalsIgnoreCase("Chrome")) {
		System.setProperty("webdriver.chrome.driver", "./Drivers/chromedriver.exe");
		driver = new ChromeDriver();
		
	} else if (browser.equalsIgnoreCase("firefox")) {
		System.setProperty("webdriver.gecko.driver", "./Drivers/geckodriver.exe");
		driver = new FirefoxDriver();
	} else {
		System.err.println("Opcao invalida. Digite as opções CHROME ou FIREFOX");
	}
	
	driver.get(url);
	driver.manage().window().maximize();
	driver.manage().timeouts().getPageLoadTimeout();
	System.out.println("********** Teste Iniciado **********");

	}

@AfterClass
	public static void finalizarTeste() {
	//driver.quit();
	System.out.println("******** Teste Finalizado ********");
	}
}

