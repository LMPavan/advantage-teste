package advantage.page.pages;

import java.io.IOException;

import org.openqa.selenium.By;

import advantage.page.elementos.ElementosWeb;
import advantage.page.metodos.MetodosDeTestes;

public class CadastroUsuarioPage {

	ElementosWeb elementos = new ElementosWeb();
	MetodosDeTestes metodos = new MetodosDeTestes();

	// Elementos page

	By botaoCreateNewAccount = By.xpath("//*[@class='create-new-account ng-scope']");
	By username = By.xpath("//input[@name='usernameRegisterPage']");
	By email = By.xpath("//input[@name='emailRegisterPage']");
	By password = By.xpath("//input[@name='passwordRegisterPage']");
	By confirmPassword = By.xpath("//input[@name='confirm_passwordRegisterPage']");
	By firstName = By.xpath("//input[@name='first_nameRegisterPage']");
	By lastName = By.xpath("//input[@name='last_nameRegisterPage']");
	By phoneNumber = By.xpath("//input[@name='phone_numberRegisterPage']");
	By country = By.xpath("//select[@name='countryListboxRegisterPage']");
	By opcaoBrazil = By.xpath("//option[@label='Brazil']");
	By city = By.xpath("//input[@name='cityRegisterPage']");
	By adress = By.xpath("//input[@name='addressRegisterPage']");
	By state = By.xpath("//input[@name='state_/_province_/_regionRegisterPage']");
	By postalCode = By.xpath("//input[@name='postal_codeRegisterPage']");
	By agreeConditions = By.xpath("//input[@name='i_agree']");
	By bottonRegister = By.xpath("//button[@id='register_btnundefined']");

	public void clicarUser() {
		metodos.clicar(elementos.getUser());
	}

	public void esperarCarregamentoSlow() throws InterruptedException {
		metodos.aguardarCarregamento(5000);
	}

	public void esperarCarregamentoFast() throws InterruptedException {
		metodos.aguardarCarregamento(1000);
	}

	public void clicarCreateAccount() {
		metodos.clicar(botaoCreateNewAccount);
	}

	public void preencherUsername() {
		metodos.digitar(username, "LuccaPavan");
	}

	public void preencherEmail() {
		metodos.digitar(email, "lucca.lpavan@gmail.com");
	}

	public void preencherPassword() {
		metodos.digitar(password, "Lucca123%");
	}

	public void preencherConfirmPassword() {
		metodos.digitar(confirmPassword, "Lucca123%");
	}

	public void preencherFirstName() {
		metodos.digitar(firstName, "Lucca");
	}

	public void preencherLastName() {
		metodos.digitar(lastName, "Pavan");
	}

	public void preencherPhoneNumber() {
		metodos.digitar(phoneNumber, "11930615223");
	}

	public void SelecionarCountry() throws InterruptedException {
		metodos.clicar(country);
		// Comentado pois a lista dos países está com problema
		/*
		 * metodos.aguardarCarregamento(1000); metodos.clicar(opcaoBrazil);
		 */
	}

	public void preencherCity() {
		metodos.digitar(city, "São Paulo");
	}

	public void preencherAdress() {
		metodos.digitar(adress, "Rua Faz de Conta, 1000");
	}

	public void preencherState() {
		metodos.digitar(state, "São Paulo");
	}

	public void preencherPostalCode() {
		metodos.digitar(postalCode, "07115-000");
	}

	public void clicarIAgree() {
		metodos.clicar(agreeConditions);
	}

	public void clicarRegister() {
		metodos.clicar(bottonRegister);
	}

	public void tirarScreenShot() throws IOException {
		metodos.screenShot("CT-01 Criação de uma conta");
	}

	// public void validarCriacaoCOnta(String string) {
	// metodos.validarTexto(, null);
	// }

}
