package advantage.page.pages;

import org.openqa.selenium.By;

import advantage.page.elementos.ElementosWeb;
import advantage.page.metodos.MetodosDeTestes;

public class LoginPage {

	//Elementos page logout
	By logout = By.xpath("//*[@id=\"loginMiniTitle\"]/label[3]");	
			
			
	// Elementos page login
	By username1 = By.xpath("//input[@name='username']");
	By password1 = By.xpath("//input[@name='password']");
	By botaoSignIn = By.xpath("//button[@id='sign_in_btnundefined']");

	ElementosWeb elementos = new ElementosWeb();
	MetodosDeTestes metodos = new MetodosDeTestes();

	//logout
	
	public void clicarUserLogado() {
		metodos.clicar(elementos.getUserLogado());
	}
	
	public void clicarLogout() {
		metodos.clicar(logout);
	}
	
	//login	

	
	public void esperarCarregamentoSlow() throws InterruptedException {
		metodos.aguardarCarregamento(5000);
	}

	public void esperarCarregamentoFast() throws InterruptedException {
		metodos.aguardarCarregamento(1000);
	}
	
	public void clicarUserDeslogado() {
		metodos.clicar(elementos.getUser());
	}

	public void preencherUsername() {
		metodos.digitar(username1, "LuccaPavan");
	}

	public void preencherPassword() {
		metodos.digitar(password1, "Lucca123%");
	}

	public void clicarSignIn() {
		metodos.clicar(botaoSignIn);
	}

}
