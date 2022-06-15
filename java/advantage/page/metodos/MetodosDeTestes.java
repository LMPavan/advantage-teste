package advantage.page.metodos;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;

import org.apache.commons.io.FileUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;

import advantage.page.drivers.DriversFactory;

public class MetodosDeTestes extends DriversFactory {
	
	public void irParaSite(String site) {
		driver.get(site);
	}

	/**
	 * Metodo para passar o mouse sobre um elemento informando o WebElemento
	 * 
	 * @param elemento
	 * @param texto
	 */
	public void mouseOver(By elemento) {

		Actions builder = new Actions(driver);
		WebElement element = driver.findElement(elemento);
		builder.moveToElement(element).build().perform();

	}
	
	/**
	 * Metodo para clicar em um elemento informando o WebElemento
	 * 
	 * @param elemento
	 * @param texto
	 */

	public void clicar(By elemento) {
		driver.findElement(elemento).click();
	}

	/**
	 * Metodo para digitar um texto no elemento informando o WebElemento
	 * 
	 * @param elemento
	 * @param texto
	 */
	public void digitar(By elemento, String texto) {
		driver.findElement(elemento).sendKeys(texto);
	}
	
	/**
	 * Metodo para esperar a pagina carregar informando o tempo desejado em milisegundos
	 * 
	 * @param elemento
	 * @param texto
	 */
	public void aguardarCarregamento(int tempoDesejado) throws InterruptedException {
		Thread.sleep(tempoDesejado);
	}

	/**
	 * Valida se o textoo capturado contém o texto esperado informando o WebElemento
	 * 
	 * @param elemento
	 * @param texto
	 */
	public void validarTexto(By elemento, String textoEsperado) {
		String textoCapturado = driver.findElement(elemento).getText();
		assertEquals(textoCapturado, textoEsperado);
	}
	
	/**
	 * Tirar uma evidência do teste executado
	 * 
	 * @param elemento
	 * @param texto
	 */
	public void screenShot(String nomeEvidencia) throws IOException {
		TakesScreenshot scrShot = (TakesScreenshot) driver;
		File scrFile = scrShot.getScreenshotAs(OutputType.FILE);
		File destFile = new File("./evidencias/"+nomeEvidencia+".png");
		FileUtils .copyFile(scrFile, destFile);
	}

}
