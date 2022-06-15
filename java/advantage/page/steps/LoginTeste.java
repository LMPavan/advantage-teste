package advantage.page.steps;

import advantage.page.pages.LoginPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class LoginTeste {
	
	LoginPage login = new LoginPage();
	
	//logout

	@Given("eu esteja na pagina devidamente logado")
	public void euEstejaNaPaginaDevidamenteLogado() {
	}
	
	@When("eu clicar em user na pagina logado")
	public void euClicarEmUserNaPaginaLogado() throws InterruptedException {
		login.esperarCarregamentoSlow();
		login.clicarUserLogado();
	}
	
	@When("clicar em sign out")
	public void clicarEmSignOut() throws InterruptedException {
		login.esperarCarregamentoFast();
		login.clicarLogout();
	}
	
	@Then("estarei deslogado")
	public void estareiDeslogado() {
	}
	
	//login

	@Given("eu esteja na pagina inicial deslogado")
	public void euEstejaNaPaginaInicialDeslogado() {
	}

	@When("eu clicar em user na pagina deslogado")
	public void euClicarEmUserNaPaginaDeslogado() throws InterruptedException {
		login.esperarCarregamentoSlow();
		login.clicarUserDeslogado();
	}

	@When("preencher meu username")
	public void preencherMeuUsername() throws InterruptedException {
		login.esperarCarregamentoFast();
		login.preencherUsername();
	}
	
	@When("preencher meu password")
	public void preencherMeuPassword() throws InterruptedException {
		login.esperarCarregamentoFast();
		login.preencherPassword();
	}
	
	@When("clicar no botao sign in")
	public void clicarNoBotaoSignIn() throws InterruptedException {
		login.esperarCarregamentoFast();
		login.clicarSignIn();
	}
	
	@Then("login sera realizado")
	public void loginSeraRealizado() {
	}








}
