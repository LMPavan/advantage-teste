package advantage.page.steps;

import advantage.page.pages.ExcluirContaPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

public class ExcluirCadastroTeste {
	
	ExcluirContaPage excluir = new ExcluirContaPage();
	
	//Ir para My Account
	

	@Given("eu esteja na pagina inicial devidamente logado")
	public void euEstejaNaPaginaInicialDevidamenteLogado() {
	}
	
	@When("eu clicar no botao user")
	public void euClicarNoBotaoUser() throws InterruptedException {
		excluir.esperarCarregamentoSlow();
		excluir.clicarUserLogado();
		
	}
	
	@When("clicar no botao my account")
	public void clicarNoBotaoMyAccount() throws InterruptedException {
		excluir.esperarCarregamentoFast();
		excluir.clicarMyAccount();
	}
	
	@Then("eu irei para a pagina do my account")
	public void euIreiParaAPaginaDoMyAccount() {
	}
	
	//Pagina My Account

	@Given("eu esteja na pagina do my account")
	public void euEstejaNaPaginaDoMyAccount() {
	}
	
	@When("eu clicar no botao delete account")
	public void euClicarNoBotaoDeleteAccount() throws InterruptedException {
		excluir.esperarCarregamentoSlow();
		excluir.clicarDeleteAccount();
	}
	
	@When("clicar em yes")
	public void clicarEmYes() throws InterruptedException {
		excluir.esperarCarregamentoFast();
		excluir.clicarYesDelete();
	}
	
	@Then("validamos a mensagem")
	public void validamosAMensagem() throws InterruptedException {
		excluir.esperarCarregamentoFast();
		excluir.validarMensagemExclusao("Account deleted successfully");
		
	}






	

}
